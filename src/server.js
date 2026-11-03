import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate, pool, query, execute, attachPropertyImages, attachProductImages, parseJson } from "./db.js";
import { normalizeEmail, adminEmails, hashPassword, checkPassword, publicUser, rolesForUser, hasRole, newToken, hashToken, createSession, clearSession, currentUser, requireAuth, requireAdmin, requireAnyRole, googleConfigured, googleAuthUrl, exchangeGoogleCode, upsertOAuthUser } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const app = express();
const port = Number(process.env.PORT || 3000);

app.set("trust proxy", true);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(express.static(path.join(root, "public"), { extensions: ["html"] }));

const clean = (value, max = 5000) => String(value ?? "").trim().slice(0, max);
const bool = (value) => value === true || value === 1 || value === "1" || value === "true";
const int = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : fallback;
const list = (value) => Array.isArray(value) ? value.map((item) => clean(item, 80)).filter(Boolean).slice(0, 20) : [];
const roles = (row) => rolesForUser(row);
const originFromRequest = (req, supplied) => {
  const candidate = clean(supplied || process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`, 500);
  if (!/^https?:\/\//i.test(candidate)) throw new Error("Invalid application origin.");
  return candidate.replace(/\/$/, "");
};
const safeUser = (row) => publicUser(row);

async function ensureAdminByEmail(user) {
  if (!user) return user;
  const expected = adminEmails().has(normalizeEmail(user.email));
  if (expected && !user.is_admin) {
    await execute("UPDATE users SET is_admin=1 WHERE id=?", [user.id]);
    user.is_admin = 1;
  }
  return user;
}

async function findUserByEmail(email) {
  return (await query("SELECT * FROM users WHERE email=? LIMIT 1", [normalizeEmail(email)]))[0];
}

async function insertRoleApplications(userId, requestedRoles, payload = {}) {
  for (const role of requestedRoles.filter((role) => ["Landlord / agent", "Vendor"].includes(role))) {
    const existing = await query("SELECT id FROM role_applications WHERE user_id=? AND role_type=? AND status='pending' LIMIT 1", [userId, role]);
    if (!existing.length) await execute("INSERT INTO role_applications (user_id, role_type, payload_json) VALUES (?, ?, ?)", [userId, role, JSON.stringify(payload)]);
  }
}

async function propertyById(id) {
  const rows = await query("SELECT p.*, u.name AS owner_name, u.email AS owner_email FROM properties p LEFT JOIN users u ON u.id=p.owner_id WHERE p.id=? LIMIT 1", [id]);
  return (await attachPropertyImages(rows))[0];
}

async function productById(id) {
  const rows = await query("SELECT p.*, u.name AS vendor_name, u.email AS vendor_email FROM products p LEFT JOIN users u ON u.id=p.vendor_id WHERE p.id=? LIMIT 1", [id]);
  return (await attachProductImages(rows))[0];
}

async function updateRoles(userId, role) {
  const user = (await query("SELECT * FROM users WHERE id=?", [userId]))[0];
  if (!user) return;
  const next = new Set(roles(user)); next.add(role);
  await execute("UPDATE users SET roles_json=? WHERE id=?", [JSON.stringify([...next]), userId]);
}

async function presignStorage(key) {
  if (!process.env.MANUS_API_URL || !process.env.MANUS_API_KEY) throw new Error("Project storage is not configured in this environment yet.");
  const url = `${process.env.MANUS_API_URL.replace(/\/$/, "")}/v1/storage/presign/put?path=${encodeURIComponent(key)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.MANUS_API_KEY}` } });
  const body = await response.json();
  if (!response.ok || !body.url) throw new Error(body.error || "Could not prepare image upload.");
  return body.url;
}

app.get("/api/health", async (_req, res) => { res.json({ ok: true, service: "campusplug", timestamp: new Date().toISOString() }); });
app.get("/api/config", (_req, res) => res.json({ googleConfigured: googleConfigured(), features: { emailAuth: true, storage: Boolean(process.env.MANUS_API_URL && process.env.MANUS_API_KEY) } }));

app.get("/api/me", async (req, res, next) => { try { const user = await ensureAdminByEmail(await currentUser(req)); res.json({ user: safeUser(user) }); } catch (error) { next(error); } });
app.post("/api/auth/signup", async (req, res, next) => {
  try {
    const name = clean(req.body.name, 160), email = normalizeEmail(req.body.email), password = String(req.body.password || ""), phone = clean(req.body.phone, 40), requestedRoles = list(req.body.roles);
    if (name.length < 2 || !email.includes("@") || password.length < 8) return res.status(400).json({ error: "Enter your name, a valid email, and a password of at least 8 characters." });
    if ((await findUserByEmail(email))) return res.status(409).json({ error: "An account already exists for that email. Try signing in instead." });
    const isAdmin = adminEmails().has(email) ? 1 : 0;
    const baseRoles = ["Student"];
    const userResult = await execute("INSERT INTO users (email, password_hash, name, phone, roles_json, is_admin) VALUES (?, ?, ?, ?, ?, ?)", [email, await hashPassword(password), name, phone || null, JSON.stringify(baseRoles), isAdmin]);
    const user = (await query("SELECT * FROM users WHERE id=?", [userResult.insertId]))[0];
    await insertRoleApplications(user.id, requestedRoles, { name, email, phone });
    await createSession(res, user.id);
    res.status(201).json({ user: safeUser(user), message: requestedRoles.some((role) => role !== "Student") ? "Account created. Your extra role applications are waiting for admin review." : "Account created." });
  } catch (error) { next(error); }
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email), password = String(req.body.password || "");
    const user = await ensureAdminByEmail(await findUserByEmail(email));
    if (!user || !(await checkPassword(password, user.password_hash))) return res.status(401).json({ error: "Email or password is not correct." });
    await createSession(res, user.id); res.json({ user: safeUser(user) });
  } catch (error) { next(error); }
});
app.post("/api/auth/logout", async (req, res, next) => { try { await clearSession(req, res); res.json({ ok: true }); } catch (error) { next(error); } });
app.get("/api/auth/google/start", async (req, res, next) => {
  try {
    if (!googleConfigured()) return res.status(503).json({ error: "Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in project settings." });
    const origin = originFromRequest(req, req.query.origin);
    const state = newToken(); const { redirectUri, url } = googleAuthUrl(origin, state);
    await execute("INSERT INTO auth_states (state_token, redirect_uri, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))", [hashToken(state), redirectUri]);
    res.json({ url });
  } catch (error) { next(error); }
});
app.get("/api/auth/google/callback", async (req, res, next) => {
  try {
    const stateHash = hashToken(clean(req.query.state, 200));
    const authState = (await query("SELECT * FROM auth_states WHERE state_token=? AND expires_at>NOW() LIMIT 1", [stateHash]))[0];
    if (!authState || !req.query.code) return res.status(400).send("Google sign-in expired. Return to CampusPlug and try again.");
    await execute("DELETE FROM auth_states WHERE state_token=?", [stateHash]);
    const profile = await exchangeGoogleCode(String(req.query.code), authState.redirect_uri);
    const user = await ensureAdminByEmail(await upsertOAuthUser(profile));
    const redirect = new URL(authState.redirect_uri).origin;
    await createSession(res, user.id);
    res.redirect(`${redirect}/?auth=success`);
  } catch (error) { next(error); }
});

app.get("/api/properties", async (req, res, next) => {
  try {
    const params = [], where = ["p.published=1", "p.status='approved'"];
    const q = clean(req.query.q, 120), area = clean(req.query.area, 100), max = int(req.query.max, 0), walk = int(req.query.walk, 0), sort = clean(req.query.sort, 10);
    if (q) { where.push("(p.title LIKE ? OR p.area LIKE ? OR p.facilities_json LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (area) { where.push("p.area=?"); params.push(area); }
    if (max) { where.push("p.price_year<=?"); params.push(max); }
    if (walk) { where.push("p.walk_minutes<=?"); params.push(walk); }
    const order = sort === "price" ? "p.price_year ASC" : sort === "rating" ? "p.walk_minutes ASC" : sort === "far" ? "p.walk_minutes DESC" : "p.updated_at DESC";
    const rows = await query(`SELECT p.*, u.name AS owner_name FROM properties p LEFT JOIN users u ON u.id=p.owner_id WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 100`, params);
    const user = await currentUser(req); const favRows = user ? await query("SELECT property_id FROM favorites WHERE user_id=?", [user.id]) : [];
    res.json({ properties: await attachPropertyImages(rows), favoriteIds: favRows.map((row) => row.property_id), areas: [...new Set(rows.map((row) => row.area))] });
  } catch (error) { next(error); }
});
app.get("/api/products", async (_req, res, next) => { try { const rows = await query("SELECT p.*, u.name AS vendor_name FROM products p LEFT JOIN users u ON u.id=p.vendor_id WHERE p.published=1 AND p.status='approved' ORDER BY p.updated_at DESC LIMIT 100"); res.json({ products: await attachProductImages(rows) }); } catch (error) { next(error); } });
app.get("/api/posts", async (_req, res, next) => { try { res.json({ posts: await query("SELECT id, post_type, title, body, is_demo, created_at FROM campus_posts WHERE status='published' ORDER BY created_at DESC") }); } catch (error) { next(error); } });
app.get("/api/social", async (_req, res, next) => { try { const row=(await query("SELECT setting_value FROM app_settings WHERE setting_key=\'social_links_json\' LIMIT 1"))[0]; res.json({ links: parseJson(row?.setting_value, []) }); } catch (error) { next(error); } });
app.get("/api/roommates", async (_req, res, next) => { try { const rows=await query("SELECT r.*, u.name AS user_name FROM roommate_listings r JOIN users u ON u.id=r.user_id WHERE r.published=1 AND r.status=\'approved\' ORDER BY r.created_at DESC LIMIT 100"); res.json({ listings: rows }); } catch (error) { next(error); } });
app.post("/api/roommates", requireAuth, async (req,res,next)=>{ try { const b=req.body; const title=clean(b.title,180), area=clean(b.area,100), lookingFor=clean(b.lookingFor,120), bio=clean(b.bio,2000), budget=int(b.budget,0); if(!title||!area||!lookingFor||!bio||!budget) return res.status(400).json({error:"Complete the roommate profile and budget before submitting."}); const result=await execute("INSERT INTO roommate_listings (user_id,title,area,budget,move_in_date,looking_for,bio) VALUES (?,?,?,?,?,?,?)",[req.user.id,title,area,budget,b.moveInDate||null,lookingFor,bio]); res.status(201).json({id:result.insertId,message:"Roommate profile submitted for review."}); } catch(error){next(error)} });
app.post("/api/roommates/:id/requests", requireAuth, async (req,res,next)=>{ try { const message=clean(req.body.message,1200); if(!message) return res.status(400).json({error:"Write a short introduction first."}); await execute("INSERT INTO roommate_requests (listing_id,requester_id,message) SELECT ?,?,? FROM roommate_listings WHERE id=? AND published=1 AND status=\'approved\'",[int(req.params.id),req.user.id,message,int(req.params.id)]); res.status(201).json({message:"Your roommate introduction was sent."}); } catch(error){next(error)} });

app.post("/api/favorites/:propertyId", requireAuth, async (req, res, next) => { try { await execute("INSERT IGNORE INTO favorites (user_id, property_id) SELECT ?, id FROM properties WHERE id=? AND published=1", [req.user.id, int(req.params.propertyId)]); res.json({ ok: true }); } catch (error) { next(error); } });
app.delete("/api/favorites/:propertyId", requireAuth, async (req, res, next) => { try { await execute("DELETE FROM favorites WHERE user_id=? AND property_id=?", [req.user.id, int(req.params.propertyId)]); res.json({ ok: true }); } catch (error) { next(error); } });
app.get("/api/saved", requireAuth, async (req, res, next) => { try { const rows = await query("SELECT p.*, u.name AS owner_name FROM favorites f JOIN properties p ON p.id=f.property_id LEFT JOIN users u ON u.id=p.owner_id WHERE f.user_id=? ORDER BY f.created_at DESC", [req.user.id]); res.json({ properties: await attachPropertyImages(rows) }); } catch (error) { next(error); } });

app.post("/api/enquiries", requireAuth, async (req, res, next) => { try { const propertyId = int(req.body.propertyId, 0) || null, productId = int(req.body.productId, 0) || null, kind = clean(req.body.kind || "question", 32), message = clean(req.body.message, 2000); if (!message || (!propertyId && !productId)) return res.status(400).json({ error: "Choose a listing and write a short message." }); await execute("INSERT INTO enquiries (user_id, property_id, product_id, kind, message) VALUES (?, ?, ?, ?, ?)", [req.user.id, propertyId, productId, kind, message]); res.status(201).json({ message: "Enquiry submitted. You can follow its status from your account." }); } catch (error) { next(error); } });
app.get("/api/my/enquiries", requireAuth, async (req, res, next) => { try { res.json({ enquiries: await query("SELECT e.*, p.title AS property_title, pr.title AS product_title FROM enquiries e LEFT JOIN properties p ON p.id=e.property_id LEFT JOIN products pr ON pr.id=e.product_id WHERE e.user_id=? ORDER BY e.created_at DESC", [req.user.id]) }); } catch (error) { next(error); } });

app.post("/api/applications/:role", requireAuth, async (req, res, next) => {
  try {
    const role = req.params.role === "vendor" ? "Vendor" : req.params.role === "landlord" ? "Landlord / agent" : null;
    if (!role) return res.status(400).json({ error: "Unknown application type." });
    const payload = { ...req.body }; delete payload.password;
    const recent = await query("SELECT id FROM role_applications WHERE user_id=? AND role_type=? AND status='pending' LIMIT 1", [req.user.id, role]);
    if (recent.length) return res.status(409).json({ error: "You already have a pending application for this role." });
    const required = role === "Vendor" ? ["businessName", "phone", "category", "location", "details"] : ["nameOrAgency", "phone", "areas", "details"];
    if (required.some((key) => !clean(payload[key], 500))) return res.status(400).json({ error: "Complete all required application fields before submitting." });
    const result = await execute("INSERT INTO role_applications (user_id, role_type, payload_json) VALUES (?, ?, ?)", [req.user.id, role, JSON.stringify(payload)]);
    res.status(201).json({ id: result.insertId, message: "Application submitted for admin review." });
  } catch (error) { next(error); }
});

app.post("/api/properties", requireAuth, requireAnyRole("Landlord / agent"), async (req, res, next) => {
  try {
    const b = req.body; const title = clean(b.title, 180), description = clean(b.description, 5000), area = clean(b.area, 100), price = int(b.priceYear, 0);
    if (!title || !description || !area || !price) return res.status(400).json({ error: "Add a title, description, area, and yearly price." });
    const result = await execute("INSERT INTO properties (owner_id, title, description, area, price_year, walk_minutes, facilities_json, availability_status, availability_date, video_url, status, published, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 'unverified')", [req.user.id, title, description, area, price, Number(b.walkMinutes || 0), JSON.stringify(list(b.facilities)), clean(b.availabilityStatus || "available", 32), b.availabilityDate || null, clean(b.videoUrl, 700) || null]);
    await saveImages("property", result.insertId, list(b.images));
    res.status(201).json({ property: await propertyById(result.insertId), message: "Property saved and sent to admin review." });
  } catch (error) { next(error); }
});
app.get("/api/my/properties", requireAuth, async (req, res, next) => { try { const rows = await query("SELECT * FROM properties WHERE owner_id=? ORDER BY updated_at DESC", [req.user.id]); res.json({ properties: await attachPropertyImages(rows) }); } catch (error) { next(error); } });
app.post("/api/products", requireAuth, requireAnyRole("Vendor"), async (req, res, next) => {
  try {
    const b = req.body, title = clean(b.title, 180), description = clean(b.description, 5000), price = int(b.price, 0);
    if (!title || !description || !price) return res.status(400).json({ error: "Add a product name, description, and price." });
    const result = await execute("INSERT INTO products (vendor_id, title, description, price, stock_status, delivery_info, status, published) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)", [req.user.id, title, description, price, clean(b.stockStatus || "in_stock", 32), clean(b.deliveryInfo, 240)]);
    await saveImages("product", result.insertId, list(b.images));
    res.status(201).json({ product: await productById(result.insertId), message: "Product saved and sent to admin review." });
  } catch (error) { next(error); }
});
app.get("/api/my/products", requireAuth, async (req, res, next) => { try { const rows = await query("SELECT * FROM products WHERE vendor_id=? ORDER BY updated_at DESC", [req.user.id]); res.json({ products: await attachProductImages(rows) }); } catch (error) { next(error); } });

async function saveImages(kind, id, images) {
  const table = kind === "property" ? "property_images" : "product_images";
  const foreign = kind === "property" ? "property_id" : "product_id";
  for (const [index, image] of images.slice(0, 8).entries()) {
    if (!/^\/manus-storage\/[A-Za-z0-9._/-]+$/.test(image.url || "")) continue;
    await execute(`INSERT INTO ${table} (${foreign}, storage_key, url, alt_text, sort_order) VALUES (?, ?, ?, ?, ?)`, [id, clean(image.key, 500), clean(image.url, 700), clean(image.alt, 180) || null, index]);
  }
}
app.post("/api/uploads/presign", requireAuth, async (req, res, next) => {
  try {
    const mime = clean(req.body.mime, 80), size = int(req.body.size, 0), kind = req.body.kind === "product" ? "product" : "property";
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(mime) || size < 1 || size > 8 * 1024 * 1024) return res.status(400).json({ error: "Use a JPG, PNG, WebP, or GIF image up to 8 MB." });
    if (kind === "property" && !hasRole(req.user, "Landlord / agent")) return res.status(403).json({ error: "Only approved accommodation partners can upload property images." });
    if (kind === "product" && !hasRole(req.user, "Vendor")) return res.status(403).json({ error: "Only approved vendors can upload product images." });
    const key = `campusplug/${kind}/${req.user.id}/${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
    const uploadUrl = await presignStorage(key);
    res.json({ key, uploadUrl, url: `/manus-storage/${key}` });
  } catch (error) { next(error); }
});

app.get("/api/admin/overview", requireAdmin, async (_req, res, next) => { try { const [[users], [properties], [products], [applications], [enquiries]] = await Promise.all([query("SELECT COUNT(*) AS count FROM users"), query("SELECT COUNT(*) AS count FROM properties WHERE is_demo=0"), query("SELECT COUNT(*) AS count FROM products WHERE is_demo=0"), query("SELECT COUNT(*) AS count FROM role_applications WHERE status='pending'"), query("SELECT COUNT(*) AS count FROM enquiries WHERE status='new'")]); res.json({ counts: { users: users.count, properties: properties.count, products: products.count, applications: applications.count, enquiries: enquiries.count } }); } catch (error) { next(error); } });
app.get("/api/admin/applications", requireAdmin, async (req, res, next) => { try { const type = req.query.type === "Vendor" || req.query.type === "Landlord / agent" ? req.query.type : null; const params = type ? [type] : []; const rows = await query(`SELECT a.*, u.name AS applicant_name, u.email AS applicant_email, u.phone AS applicant_phone FROM role_applications a JOIN users u ON u.id=a.user_id ${type ? "WHERE a.role_type=?" : ""} ORDER BY FIELD(a.status,'pending','approved','rejected'), a.created_at DESC LIMIT 200`, params); res.json({ applications: rows.map((row) => ({ ...row, payload: parseJson(row.payload_json, {}) })) }); } catch (error) { next(error); } });
app.get("/api/admin/properties", requireAdmin, async (_req, res, next) => { try { const rows = await query("SELECT p.*, u.name AS owner_name, u.email AS owner_email FROM properties p LEFT JOIN users u ON u.id=p.owner_id ORDER BY FIELD(p.status,'pending','approved','rejected'), p.updated_at DESC LIMIT 200"); res.json({ properties: await attachPropertyImages(rows) }); } catch (error) { next(error); } });
app.get("/api/admin/products", requireAdmin, async (_req, res, next) => { try { const rows = await query("SELECT p.*, u.name AS vendor_name, u.email AS vendor_email FROM products p LEFT JOIN users u ON u.id=p.vendor_id ORDER BY FIELD(p.status,'pending','approved','rejected'), p.updated_at DESC LIMIT 200"); res.json({ products: await attachProductImages(rows) }); } catch (error) { next(error); } });
app.get("/api/admin/enquiries", requireAdmin, async (_req, res, next) => { try { res.json({ enquiries: await query("SELECT e.*, u.name AS user_name, u.email, p.title AS property_title, pr.title AS product_title FROM enquiries e JOIN users u ON u.id=e.user_id LEFT JOIN properties p ON p.id=e.property_id LEFT JOIN products pr ON pr.id=e.product_id ORDER BY e.created_at DESC LIMIT 200") }); } catch (error) { next(error); } });
app.patch("/api/admin/applications/:id", requireAdmin, async (req, res, next) => { try { const status = ["pending", "approved", "rejected"].includes(req.body.status) ? req.body.status : null; if (!status) return res.status(400).json({ error: "Invalid application status." }); const application = (await query("SELECT * FROM role_applications WHERE id=?", [int(req.params.id)]))[0]; if (!application) return res.status(404).json({ error: "Application not found." }); await execute("UPDATE role_applications SET status=?, admin_note=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?", [status, clean(req.body.note, 2000) || null, req.user.id, application.id]); if (status === "approved") await updateRoles(application.user_id, application.role_type); res.json({ ok: true }); } catch (error) { next(error); } });
app.patch("/api/admin/properties/:id", requireAdmin, async (req, res, next) => { try { const b = req.body, status = ["pending", "approved", "rejected", "hidden"].includes(b.status) ? b.status : null; if (!status) return res.status(400).json({ error: "Invalid property status." }); const published = status === "approved" && bool(b.published); await execute("UPDATE properties SET status=?, published=?, verification_status=?, admin_note=?, title=COALESCE(NULLIF(?,''),title), description=COALESCE(NULLIF(?,''),description), price_year=COALESCE(NULLIF(?,0),price_year), updated_at=NOW() WHERE id=?", [status, published ? 1 : 0, clean(b.verificationStatus || "unverified", 32), clean(b.note, 2000) || null, clean(b.title, 180), clean(b.description, 5000), int(b.priceYear, 0), int(req.params.id)]); res.json({ property: await propertyById(req.params.id) }); } catch (error) { next(error); } });
app.patch("/api/admin/products/:id", requireAdmin, async (req, res, next) => { try { const b = req.body, status = ["pending", "approved", "rejected", "hidden"].includes(b.status) ? b.status : null; if (!status) return res.status(400).json({ error: "Invalid product status." }); const published = status === "approved" && bool(b.published); await execute("UPDATE products SET status=?, published=?, admin_note=?, title=COALESCE(NULLIF(?,''),title), description=COALESCE(NULLIF(?,''),description), price=COALESCE(NULLIF(?,0),price), updated_at=NOW() WHERE id=?", [status, published ? 1 : 0, clean(b.note, 2000) || null, clean(b.title, 180), clean(b.description, 5000), int(b.price, 0), int(req.params.id)]); res.json({ product: await productById(req.params.id) }); } catch (error) { next(error); } });
app.post("/api/admin/properties", requireAdmin, async (req, res, next) => { try { const b = req.body; const result = await execute("INSERT INTO properties (title, description, area, price_year, walk_minutes, facilities_json, availability_status, status, published, verification_status, admin_note) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 1, 'verified', ?)", [clean(b.title, 180), clean(b.description, 5000), clean(b.area, 100), int(b.priceYear), Number(b.walkMinutes || 0), JSON.stringify(list(b.facilities)), clean(b.availabilityStatus || "available", 32), "Added by admin"]); await saveImages("property", result.insertId, list(b.images)); res.status(201).json({ property: await propertyById(result.insertId) }); } catch (error) { next(error); } });
app.post("/api/admin/products", requireAdmin, async (req, res, next) => { try { const b = req.body; const result = await execute("INSERT INTO products (title, description, price, stock_status, delivery_info, status, published, verification_status, admin_note) VALUES (?, ?, ?, ?, ?, 'approved', 1, 'verified', ?)", [clean(b.title, 180), clean(b.description, 5000), int(b.price), clean(b.stockStatus || "in_stock", 32), clean(b.deliveryInfo, 240), "Added by admin"]); await saveImages("product", result.insertId, list(b.images)); res.status(201).json({ product: await productById(result.insertId) }); } catch (error) { next(error); } });
app.get("/api/admin/posts", requireAdmin, async (_req,res,next)=>{try{res.json({posts:await query("SELECT * FROM campus_posts ORDER BY created_at DESC LIMIT 200")})}catch(error){next(error)}});
app.post("/api/admin/posts", requireAdmin, async (req,res,next)=>{try{const b=req.body;const title=clean(b.title,180),body=clean(b.body,8000),postType=clean(b.postType||"news",40);if(!title||!body)return res.status(400).json({error:"Add a headline and update body."});const result=await execute("INSERT INTO campus_posts (author_id,post_type,title,body,status,is_demo) VALUES (?,?,?,?,\'published\',0)",[req.user.id,postType,title,body]);res.status(201).json({id:result.insertId})}catch(error){next(error)}});
app.patch("/api/admin/posts/:id", requireAdmin, async (req,res,next)=>{try{await execute("UPDATE campus_posts SET title=COALESCE(NULLIF(?,\'\'),title), body=COALESCE(NULLIF(?,\'\'),body), status=IF(?=\'hidden\',\'hidden\',\'published\'), updated_at=NOW() WHERE id=?",[clean(req.body.title,180),clean(req.body.body,8000),clean(req.body.status,20),int(req.params.id)]);res.json({ok:true})}catch(error){next(error)}});
app.get("/api/admin/social", requireAdmin, async (_req,res,next)=>{try{const row=(await query("SELECT setting_value FROM app_settings WHERE setting_key=\'social_links_json\' LIMIT 1"))[0];res.json({links:parseJson(row?.setting_value,[])})}catch(error){next(error)}});
app.put("/api/admin/social", requireAdmin, async (req,res,next)=>{try{const links=Array.isArray(req.body.links)?req.body.links.slice(0,12).map(x=>({name:clean(x.name,60),url:clean(x.url,500),description:clean(x.description,180)})).filter(x=>x.name&&/^https?:\/\//i.test(x.url)):[];await execute("INSERT INTO app_settings (setting_key,setting_value) VALUES (\'social_links_json\',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",[JSON.stringify(links)]);res.json({links})}catch(error){next(error)}});
app.get("/api/admin/roommates", requireAdmin, async (_req,res,next)=>{try{res.json({listings:await query("SELECT r.*,u.name AS user_name,u.email FROM roommate_listings r JOIN users u ON u.id=r.user_id ORDER BY FIELD(r.status,\'pending\',\'approved\',\'rejected\'),r.created_at DESC")})}catch(error){next(error)}});
app.patch("/api/admin/roommates/:id", requireAdmin, async (req,res,next)=>{try{const status=["pending","approved","rejected","hidden"].includes(req.body.status)?req.body.status:"pending";await execute("UPDATE roommate_listings SET status=?,published=?,updated_at=NOW() WHERE id=?",[status,status==="approved"?1:0,int(req.params.id)]);res.json({ok:true})}catch(error){next(error)}});
app.patch("/api/admin/reports/:id", requireAdmin, async (req, res, next) => { try { const status = ["open", "dismissed", "resolved"].includes(req.body.status) ? req.body.status : "dismissed"; await execute("UPDATE reports SET status=?, admin_note=?, resolved_at=IF(? IN ('dismissed','resolved'), NOW(), NULL) WHERE id=?", [status, clean(req.body.note, 2000) || null, status, int(req.params.id)]); res.json({ ok: true }); } catch (error) { next(error); } });

app.use((req, res, next) => { if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API route not found." }); res.sendFile(path.join(root, "public", "index.html")); });
app.use((error, _req, res, _next) => { console.error(error); res.status(error.status || 500).json({ error: error.message || "Something went wrong. Try again." }); });

await migrate();
app.listen(port, "0.0.0.0", () => console.log(`CampusPlug listening on ${port}`));
