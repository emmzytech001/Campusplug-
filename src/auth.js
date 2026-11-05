import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { execute, query, parseJson } from "./db.js";

export const SESSION_COOKIE = "webdev_app_session";
const SESSION_DAYS = 30;

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function adminEmails() {
  return new Set(String(process.env.ADMIN_EMAILS || "").split(",").map((email) => normalizeEmail(email)).filter(Boolean));
}

export function newToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function checkPassword(password, hash) {
  return Boolean(hash) && bcrypt.compare(password, hash);
}

export function rolesForUser(row) {
  const roles = parseJson(row?.roles_json, ["Student"]);
  return Array.isArray(roles) && roles.length ? roles : ["Student"];
}

export function publicUser(row) {
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, phone: row.phone, avatarUrl: row.avatar_url, bio: row.bio || "", department: row.department || "", level: row.level || "", preferredArea: row.preferred_area || "", roommatePreferences: row.roommate_preferences || "", profileVisibility: row.profile_visibility || "public", roles: rolesForUser(row), isAdmin: Boolean(row.is_admin), status: row.status };
}

export function hasRole(user, role) {
  return Boolean(user && (user.is_admin || rolesForUser(user).includes(role)));
}

function cookieOptions() {
  return { httpOnly: true, secure: process.env.COOKIE_SECURE !== "false", sameSite: "none", path: "/", maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 };
}

export async function createSession(res, userId) {
  const token = newToken();
  await execute("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))", [hashToken(token), userId, SESSION_DAYS]);
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  return token;
}

export async function clearSession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await execute("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.COOKIE_SECURE !== "false", sameSite: "none", path: "/" });
}

export async function currentUser(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const rows = await query("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW() AND u.status='active' LIMIT 1", [hashToken(token)]);
  return rows[0] || null;
}

export async function requireAuth(req, res, next) {
  try {
    req.user = await currentUser(req);
    if (!req.user) return res.status(401).json({ error: "Please sign in to continue." });
    next();
  } catch (error) { next(error); }
}

export async function requireAdmin(req, res, next) {
  try {
    req.user = req.user || await currentUser(req);
    if (!req.user?.is_admin) return res.status(403).json({ error: "Admin access is required." });
    next();
  } catch (error) { next(error); }
}

export function requireAnyRole(...roles) {
  return async (req, res, next) => {
    try {
      req.user = req.user || await currentUser(req);
      if (!req.user || (!req.user.is_admin && !roles.some((role) => rolesForUser(req.user).includes(role)))) return res.status(403).json({ error: "Your account does not have permission for this action." });
      next();
    } catch (error) { next(error); }
  };
}

export async function upsertOAuthUser({ email, name, googleSub, avatarUrl }) {
  const normalized = normalizeEmail(email);
  const existing = (await query("SELECT * FROM users WHERE email=? OR google_sub=? LIMIT 1", [normalized, googleSub]))[0];
  const isAdmin = adminEmails().has(normalized) ? 1 : Number(existing?.is_admin || 0);
  if (existing) {
    await execute("UPDATE users SET name=?, google_sub=COALESCE(google_sub, ?), avatar_url=COALESCE(?, avatar_url), is_admin=? WHERE id=?", [name || existing.name, googleSub, avatarUrl || null, isAdmin, existing.id]);
    return (await query("SELECT * FROM users WHERE id=?", [existing.id]))[0];
  }
  const result = await execute("INSERT INTO users (email, google_sub, name, avatar_url, roles_json, is_admin) VALUES (?, ?, ?, ?, ?, ?)", [normalized, googleSub, name || normalized.split("@")[0], avatarUrl || null, JSON.stringify(["Student"]), isAdmin]);
  return (await query("SELECT * FROM users WHERE id=?", [result.insertId]))[0];
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(origin, state) {
  const redirectUri = `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", access_type: "offline", prompt: "select_account", state });
  return { redirectUri, url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
}

export async function exchangeGoogleCode(code, redirectUri) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token) throw new Error(token.error_description || token.error || "Google sign-in could not be completed.");
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || !profile.email) throw new Error("Google did not return an email address.");
  return { email: profile.email, name: profile.name || profile.email.split("@")[0], googleSub: profile.sub, avatarUrl: profile.picture || null };
}
