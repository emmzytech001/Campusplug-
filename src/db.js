import mysql from "mysql2/promise";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export const pool = mysql.createPool({
  uri: process.env.DATABASE_URL || process.env.DRIZZLE_DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 8,
  queueLimit: 0,
  decimalNumbers: true,
  supportBigNumbers: true,
  dateStrings: true
});

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result;
}

export async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.query("CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    const files = (await fs.readdir(path.join(root, "migrations"))).filter((name) => name.endsWith(".sql")).sort();
    for (const name of files) {
      const [found] = await conn.query("SELECT name FROM schema_migrations WHERE name = ?", [name]);
      if (found.length) continue;
      const sql = await fs.readFile(path.join(root, "migrations", name), "utf8");
      await conn.beginTransaction();
      try {
        for (const statement of sql.split(/;\s*(?:\n|$)/).map((part) => part.trim()).filter(Boolean)) {
          await conn.query(statement);
        }
        await conn.query("INSERT INTO schema_migrations (name) VALUES (?)", [name]);
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      }
    }
  } finally {
    conn.release();
  }
}

export function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export async function propertyImages(ids) {
  if (!ids.length) return new Map();
  const rows = await query(`SELECT property_id, storage_key, url, alt_text, sort_order FROM property_images WHERE property_id IN (${ids.map(() => "?").join(",")}) ORDER BY sort_order, id`, ids);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.property_id)) map.set(row.property_id, []);
    map.get(row.property_id).push({ key: row.storage_key, url: row.url, alt: row.alt_text || "CampusPlug property image" });
  }
  return map;
}

export async function productImages(ids) {
  if (!ids.length) return new Map();
  const rows = await query(`SELECT product_id, storage_key, url, alt_text, sort_order FROM product_images WHERE product_id IN (${ids.map(() => "?").join(",")}) ORDER BY sort_order, id`, ids);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.product_id)) map.set(row.product_id, []);
    map.get(row.product_id).push({ key: row.storage_key, url: row.url, alt: row.alt_text || "CampusPlug product image" });
  }
  return map;
}

export async function attachPropertyImages(rows) {
  const images = await propertyImages(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, facilities: parseJson(row.facilities_json, []), images: images.get(row.id) || [] }));
}

export async function attachProductImages(rows) {
  const images = await productImages(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, images: images.get(row.id) || [] }));
}

if (process.argv.includes("--migrate")) {
  migrate().then(async () => { await pool.end(); }).catch(async (error) => { console.error(error); await pool.end(); process.exit(1); });
}
