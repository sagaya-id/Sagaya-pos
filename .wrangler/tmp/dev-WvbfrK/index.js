var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-GAJN9z/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// worker/index.js
var ADMIN_COOKIE = "bs_admin";
var SESSION_DAYS = 7;
var TZ_OFFSET_MS = 7 * 60 * 60 * 1e3;
var DEFAULT_ADMIN_PASSWORD = "sagaya2026";
var DEFAULT_SETTINGS = {
  theme: {
    primary: "#B3271E",
    primaryDark: "#8C1D16",
    accent: "#F2B233",
    bg: "#FFF7F1",
    surface: "#FFFFFF",
    text: "#2C1A15",
    muted: "#7C6A62",
    headerText: "#FFFFFF"
  },
  texts: {
    storeName: "Batagor Sagaya",
    navSubheader: "Batagor & siomay hangat, dibuat segar setiap hari",
    heroBadge: "Buka setiap hari \xB7 09.00 \u2013 21.00",
    landingTitle: "Batagor renyah, siomay lembut, bumbu kacang juara.",
    landingDesc: "Pesan langsung di kasir, pilih menu favoritmu, dan bayar tunai atau QRIS. Nomor antrean tercetak otomatis di struk.",
    landingCta: "Mulai Pesan",
    infoAddress: "Jl. Sagaya Raya No. 12, Bandung",
    infoPhone: "0812-3456-7890",
    infoHours: "Setiap hari 09.00 \u2013 21.00",
    footerText: "\xA9 2026 Batagor Sagaya \xB7 Terima kasih sudah mampir!"
  },
  receipt: {
    header1: "BATAGOR SAGAYA",
    header2: "Jl. Sagaya Raya No. 12, Bandung\nTelp 0812-3456-7890",
    footer1: "Terima kasih atas kunjungan Anda",
    footer2: "Barang yang sudah dibeli tidak dapat ditukar"
  }
};
var PUBLIC_SETTING_KEYS = ["theme", "texts", "receipt"];
var json = /* @__PURE__ */ __name((data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
}), "json");
var fail = /* @__PURE__ */ __name((status, message) => json({ error: message }, status), "fail");
var nowIso = /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "nowIso");
function jakartaDateString(d = /* @__PURE__ */ new Date()) {
  return new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}
__name(jakartaDateString, "jakartaDateString");
function jakartaDayStartIso(dateStr = jakartaDateString()) {
  return (/* @__PURE__ */ new Date(`${dateStr}T00:00:00.000+07:00`)).toISOString();
}
__name(jakartaDayStartIso, "jakartaDayStartIso");
function addDays(dateStr, days) {
  const d = /* @__PURE__ */ new Date(`${dateStr}T00:00:00.000+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}
__name(addDays, "addDays");
function monthBounds(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, end: nextMonth };
}
__name(monthBounds, "monthBounds");
function weekBounds(dateStr) {
  const d = /* @__PURE__ */ new Date(`${dateStr}T00:00:00.000Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  const monday = addDays(dateStr, -dow);
  return { start: monday, end: addDays(monday, 7) };
}
__name(weekBounds, "weekBounds");
var schemaReady = false;
var TABLE_SPECS = [
  {
    name: "products",
    cols: ["name", "price", "discount_type", "discount_value", "available", "active", "created_at", "updated_at"],
    ddl: `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      discount_type TEXT NOT NULL DEFAULT 'rp',
      discount_value INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  },
  {
    name: "settings",
    cols: ["key", "value", "updated_at"],
    ddl: `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  },
  {
    name: "transactions",
    cols: [
      "queue_no",
      "customer",
      "order_type",
      "note",
      "method",
      "subtotal",
      "discount_total",
      "total",
      "paid",
      "change_amount",
      "status",
      "created_at",
      "day",
      "voided_at"
    ],
    ddl: `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_no INTEGER NOT NULL,
      customer TEXT NOT NULL,
      order_type TEXT NOT NULL,
      note TEXT,
      method TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      discount_total INTEGER NOT NULL,
      total INTEGER NOT NULL,
      paid INTEGER NOT NULL,
      change_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Selesai',
      created_at TEXT NOT NULL,
      day TEXT NOT NULL,
      voided_at TEXT
    )`
  },
  {
    name: "transaction_items",
    cols: ["transaction_id", "product_id", "name", "qty", "unit_price", "discount_type", "discount_value", "discount_amount", "subtotal"],
    ddl: `CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      product_id INTEGER,
      name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'rp',
      discount_value INTEGER NOT NULL DEFAULT 0,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      subtotal INTEGER NOT NULL
    )`
  },
  {
    name: "sessions",
    cols: ["token", "created_at", "expires_at"],
    ddl: `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`
  },
  {
    name: "meta",
    cols: ["key", "value"],
    ddl: `CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`
  }
];
async function ensureTable(env, spec) {
  const info = await env.DB.prepare(`PRAGMA table_info(${spec.name})`).all();
  const existing = (info.results || []).map((c) => c.name);
  if (!existing.length) {
    await env.DB.prepare(spec.ddl).run();
    return;
  }
  if (spec.cols.every((c) => existing.includes(c)))
    return;
  const count = await env.DB.prepare(`SELECT COUNT(*) AS c FROM ${spec.name}`).first();
  if (!count || !count.c) {
    await env.DB.prepare(`DROP TABLE ${spec.name}`).run();
    await env.DB.prepare(spec.ddl).run();
    return;
  }
  await env.DB.prepare(`ALTER TABLE ${spec.name} RENAME TO legacy_${spec.name}_${Date.now()}`).run();
  await env.DB.prepare(spec.ddl).run();
}
__name(ensureTable, "ensureTable");
async function migrateLegacyProducts(env) {
  const done = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'products_migrated_v2'`).first();
  if (done)
    return;
  const info = await env.DB.prepare(`PRAGMA table_info(products)`).all();
  const cols = info.results || [];
  const idCol = cols.find((c) => c.name === "id");
  const integerId = idCol && /INT/i.test(String(idCol.type || ""));
  if (integerId) {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE products SET discount_type = 'rp' WHERE discount_type IS NULL OR discount_type IN ('none', 'amount', 'fixed', '')`
      ),
      env.DB.prepare(
        `UPDATE products SET discount_type = 'pct' WHERE discount_type IN ('percent', 'percentage')`
      ),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('products_migrated_v2', ?)`).bind(nowIso())
    ]);
    return;
  }
  await env.DB.prepare(`DROP TABLE IF EXISTS products_v2`).run();
  await env.DB.prepare(`CREATE TABLE products_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    discount_type TEXT NOT NULL DEFAULT 'rp',
    discount_value INTEGER NOT NULL DEFAULT 0,
    available INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  const old = await env.DB.prepare(`SELECT * FROM products`).all();
  const seen = /* @__PURE__ */ new Set();
  const stmts = [];
  for (const row of old.results || []) {
    if (row.id === null || row.id === void 0)
      continue;
    const name = String(row.name || "").trim().slice(0, 80);
    if (!name || seen.has(name.toLowerCase()))
      continue;
    seen.add(name.toLowerCase());
    const rawType = String(row.discount_type || "").toLowerCase();
    const type = ["percent", "percentage", "pct"].includes(rawType) ? "pct" : "rp";
    const price = Math.max(0, Math.round(Number(row.price) || 0));
    let value = Math.max(0, Math.round(Number(row.discount_value) || 0));
    value = type === "pct" ? Math.min(100, value) : Math.min(price, value);
    const flag = /* @__PURE__ */ __name((v) => v === 0 || v === "0" || v === false ? 0 : 1, "flag");
    stmts.push(
      env.DB.prepare(
        `INSERT INTO products_v2 (name, price, discount_type, discount_value, available, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(name, price, type, value, flag(row.available), flag(row.active), row.created_at || nowIso(), nowIso())
    );
  }
  if (stmts.length)
    await env.DB.batch(stmts);
  await env.DB.prepare(`DROP TABLE products`).run();
  await env.DB.prepare(`ALTER TABLE products_v2 RENAME TO products`).run();
  await env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('products_migrated_v2', ?)`).bind(nowIso()).run();
}
__name(migrateLegacyProducts, "migrateLegacyProducts");
async function ensureSchema(env) {
  if (schemaReady)
    return;
  for (const spec of TABLE_SPECS)
    await ensureTable(env, spec);
  await migrateLegacyProducts(env);
  const seeded = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'seeded'`).first();
  if (!seeded) {
    const ts = nowIso();
    const seeds = [
      ["Batagor Original", 12e3, "rp", 0, 1, 1],
      ["Batagor Keju Mozzarella", 18e3, "pct", 10, 1, 1],
      ["Siomay Ayam", 1e4, "rp", 0, 1, 1],
      ["Siomay Udang", 15e3, "rp", 2e3, 1, 1],
      ["Batagor Frozen (isi 10)", 45e3, "pct", 15, 1, 1],
      ["Es Teh Manis", 6e3, "rp", 0, 1, 1],
      ["Es Jeruk", 8e3, "rp", 0, 1, 1],
      ["Air Mineral", 5e3, "rp", 0, 1, 1]
    ];
    await env.DB.batch([
      ...seeds.map(
        ([name, price, dtype, dvalue, available, active]) => env.DB.prepare(
          `INSERT INTO products (name, price, discount_type, discount_value, available, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(name, price, dtype, dvalue, available, active, ts, ts)
      ),
      ...Object.entries({
        theme: DEFAULT_SETTINGS.theme,
        texts: DEFAULT_SETTINGS.texts,
        receipt: DEFAULT_SETTINGS.receipt
      }).map(
        ([key, value]) => env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`).bind(
          key,
          JSON.stringify(value),
          ts
        )
      ),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded', ?)`).bind(ts)
    ]);
  }
  await ensureAdminPassword(env);
  const deduped = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'seed_dedup_v1'`).first();
  if (!deduped) {
    const names = [
      "Batagor Original",
      "Batagor Keju Mozzarella",
      "Siomay Ayam",
      "Siomay Udang",
      "Batagor Frozen (isi 10)",
      "Es Teh Manis",
      "Es Jeruk",
      "Air Mineral"
    ];
    await env.DB.batch([
      ...names.map(
        (name) => env.DB.prepare(
          `DELETE FROM products WHERE name = ? AND id NOT IN (SELECT MIN(id) FROM products WHERE name = ?)`
        ).bind(name, name)
      ),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('seed_dedup_v1', ?)`).bind(nowIso())
    ]);
  }
  schemaReady = true;
}
__name(ensureSchema, "ensureSchema");
var enc = new TextEncoder();
var hex = /* @__PURE__ */ __name((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""), "hex");
function randomHex(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(randomHex, "randomHex");
async function hashPassword(password, saltHex) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 25e3, hash: "SHA-256" },
    key,
    256
  );
  return hex(bits);
}
__name(hashPassword, "hashPassword");
async function setAdminPassword(env, password) {
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const ts = nowIso();
  await env.DB.batch([
    env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('admin_salt', ?)`).bind(salt),
    env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('admin_hash', ?)`).bind(hash),
    env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('admin_updated', ?)`).bind(ts)
  ]);
}
__name(setAdminPassword, "setAdminPassword");
async function ensureAdminPassword(env) {
  const existing = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'admin_hash'`).first();
  if (!existing)
    await setAdminPassword(env, DEFAULT_ADMIN_PASSWORD);
}
__name(ensureAdminPassword, "ensureAdminPassword");
async function verifyAdminPassword(env, password) {
  const row = await env.DB.prepare(
    `SELECT (SELECT value FROM meta WHERE key = 'admin_hash') AS hash, (SELECT value FROM meta WHERE key = 'admin_salt') AS salt`
  ).first();
  if (!row?.hash || !row?.salt)
    return false;
  const candidate = await hashPassword(password, row.salt);
  if (candidate.length !== row.hash.length)
    return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++)
    diff |= candidate.charCodeAt(i) ^ row.hash.charCodeAt(i);
  return diff === 0;
}
__name(verifyAdminPassword, "verifyAdminPassword");
function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name)
      return rest.join("=");
  }
  return null;
}
__name(readCookie, "readCookie");
async function currentSession(request, env) {
  const token = readCookie(request, ADMIN_COOKIE);
  if (!token)
    return null;
  const row = await env.DB.prepare(`SELECT * FROM sessions WHERE token = ?`).bind(token).first();
  if (!row)
    return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return null;
  }
  return row;
}
__name(currentSession, "currentSession");
async function requireAdmin(request, env) {
  const session = await currentSession(request, env);
  if (!session)
    throw Object.assign(new Error("Sesi admin tidak valid. Silakan login ulang."), { status: 401 });
  return session;
}
__name(requireAdmin, "requireAdmin");
async function loadSettings(env, keys) {
  const placeholders = keys.map(() => "?").join(",");
  const rows = await env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).bind(...keys).all();
  const out = {};
  for (const key of keys)
    out[key] = structuredClone(DEFAULT_SETTINGS[key] || {});
  for (const row of rows.results || []) {
    try {
      out[row.key] = { ...out[row.key], ...JSON.parse(row.value) };
    } catch {
    }
  }
  return out;
}
__name(loadSettings, "loadSettings");
async function nextQueueNumber(env) {
  const today = jakartaDateString();
  const resetRow = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'queue_reset_day'`).first();
  const resetAtRow = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'queue_reset_at'`).first();
  const since = resetRow?.value === today && resetAtRow?.value ? resetAtRow.value : jakartaDayStartIso(today);
  const row = await env.DB.prepare(
    `SELECT MAX(queue_no) AS max_no FROM transactions WHERE created_at >= ?`
  ).bind(since).first();
  return (row?.max_no || 0) + 1;
}
__name(nextQueueNumber, "nextQueueNumber");
function discountPerUnit(price, type, value) {
  const v = Math.max(0, Math.round(Number(value) || 0));
  if (type === "pct")
    return Math.min(price, Math.round(price * Math.min(v, 100) / 100));
  return Math.min(price, v);
}
__name(discountPerUnit, "discountPerUnit");
async function createTransaction(env, body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length)
    throw Object.assign(new Error("Keranjang masih kosong."), { status: 400 });
  const customer = String(body.customer || "").trim() || "Pelanggan";
  const orderType = body.orderType === "Take Away" ? "Take Away" : "Dine In";
  const note = String(body.note || "").trim().slice(0, 300);
  const method = body.method === "QRIS" ? "QRIS" : "Tunai";
  const ids = [...new Set(items.map((it) => Number(it.productId || it.id)).filter(Boolean))];
  if (!ids.length)
    throw Object.assign(new Error("Produk tidak valid."), { status: 400 });
  const rows = await env.DB.prepare(
    `SELECT * FROM products WHERE id IN (${ids.map(() => "?").join(",")})`
  ).bind(...ids).all();
  const productMap = new Map((rows.results || []).map((p) => [p.id, p]));
  const lines = [];
  let subtotal = 0;
  let discountTotal = 0;
  for (const raw of items) {
    const product = productMap.get(Number(raw.productId || raw.id));
    const qty = Math.max(1, Math.min(999, Math.round(Number(raw.qty) || 1)));
    if (!product)
      throw Object.assign(new Error("Ada menu yang sudah tidak tersedia."), { status: 400 });
    if (!product.active)
      throw Object.assign(new Error(`Menu "${product.name}" sedang nonaktif.`), { status: 400 });
    if (!product.available)
      throw Object.assign(new Error(`Menu "${product.name}" sedang habis.`), { status: 400 });
    const price = Number(product.price) || 0;
    const disc = discountPerUnit(price, product.discount_type, product.discount_value);
    const net = price - disc;
    subtotal += price * qty;
    discountTotal += disc * qty;
    lines.push({
      product_id: product.id,
      name: product.name,
      qty,
      unit_price: price,
      discount_type: product.discount_type,
      discount_value: Number(product.discount_value) || 0,
      discount_amount: disc,
      subtotal: net * qty
    });
  }
  const total = subtotal - discountTotal;
  let paid = Math.round(Number(body.paid) || 0);
  if (method === "QRIS")
    paid = total;
  if (paid < total)
    throw Object.assign(new Error("Uang diterima kurang dari total pembayaran."), { status: 400 });
  const change = paid - total;
  const queueNo = await nextQueueNumber(env);
  const createdAt = nowIso();
  const day = jakartaDateString();
  const inserted = await env.DB.prepare(
    `INSERT INTO transactions
      (queue_no, customer, order_type, note, method, subtotal, discount_total, total, paid, change_amount, status, created_at, day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Selesai', ?, ?)`
  ).bind(queueNo, customer, orderType, note, method, subtotal, discountTotal, total, paid, change, createdAt, day).run();
  const txnId = inserted.meta?.last_row_id;
  try {
    await env.DB.batch(
      lines.map(
        (l) => env.DB.prepare(
          `INSERT INTO transaction_items
            (transaction_id, product_id, name, qty, unit_price, discount_type, discount_value, discount_amount, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          txnId,
          l.product_id,
          l.name,
          l.qty,
          l.unit_price,
          l.discount_type,
          l.discount_value,
          l.discount_amount,
          l.subtotal
        )
      )
    );
  } catch (err) {
    await env.DB.prepare(`DELETE FROM transactions WHERE id = ?`).bind(txnId).run();
    throw err;
  }
  return getTransaction(env, txnId);
}
__name(createTransaction, "createTransaction");
async function getTransaction(env, id) {
  const txn = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ?`).bind(id).first();
  if (!txn)
    throw Object.assign(new Error("Transaksi tidak ditemukan."), { status: 404 });
  const items = await env.DB.prepare(`SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY id ASC`).bind(id).all();
  return { ...txn, items: items.results || [] };
}
__name(getTransaction, "getTransaction");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/"))
      return env.ASSETS.fetch(request);
    try {
      await ensureSchema(env);
      return await route(request, env, url);
    } catch (err) {
      const status = err?.status || 500;
      if (status >= 500)
        console.error("API error", err?.stack || err);
      return json({ error: err?.message || "Terjadi kesalahan pada server." }, status);
    }
  }
};
async function route(request, env, url) {
  const path = url.pathname.replace(/^\/api/, "");
  const method = request.method.toUpperCase();
  const m = /* @__PURE__ */ __name((re) => path.match(re), "m");
  if (path === "/health")
    return json({ ok: true, time: nowIso() });
  if (path === "/bootstrap" && method === "GET") {
    const settings = await loadSettings(env, PUBLIC_SETTING_KEYS);
    const products = await env.DB.prepare(
      `SELECT id, name, price, discount_type, discount_value, available, active
       FROM products WHERE active = 1 ORDER BY id ASC`
    ).all();
    const queue = await nextQueueNumber(env);
    const authed = Boolean(await currentSession(request, env));
    return json({
      settings,
      products: products.results || [],
      queue,
      today: jakartaDateString(),
      authed
    });
  }
  if (path === "/queue/next" && method === "GET") {
    return json({ number: await nextQueueNumber(env), today: jakartaDateString() });
  }
  if (path === "/transactions" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    return json(await createTransaction(env, body), 201);
  }
  if (path === "/admin/session" && method === "GET") {
    const session = await currentSession(request, env);
    return json({ authed: Boolean(session) });
  }
  if (path === "/admin/login" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    const password = String(body.password || "");
    if (!password)
      return fail(400, "Sandi admin wajib diisi.");
    const ok = await verifyAdminPassword(env, password);
    if (!ok)
      return fail(401, "Sandi admin salah.");
    const token = randomHex(24);
    const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
    await env.DB.prepare(`INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)`).bind(token, nowIso(), expires).run();
    const secure = url.protocol === "https:" ? "; Secure" : "";
    return json(
      { authed: true },
      200,
      {
        "set-cookie": `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`
      }
    );
  }
  if (path === "/admin/logout" && method === "POST") {
    const token = readCookie(request, ADMIN_COOKIE);
    if (token)
      await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return json({ authed: false }, 200, {
      "set-cookie": `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    });
  }
  if (path === "/admin/products" && method === "GET") {
    await requireAdmin(request, env);
    const rows = await env.DB.prepare(`SELECT * FROM products ORDER BY active DESC, id ASC`).all();
    return json({ products: rows.results || [] });
  }
  if (path === "/admin/products" && method === "POST") {
    await requireAdmin(request, env);
    const p = normalizeProduct(await request.json().catch(() => ({})));
    const ts = nowIso();
    const res = await env.DB.prepare(
      `INSERT INTO products (name, price, discount_type, discount_value, available, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(p.name, p.price, p.discount_type, p.discount_value, p.available, p.active, ts, ts).run();
    return json({ id: res.meta?.last_row_id, ...p }, 201);
  }
  const productIdMatch = m(/^\/admin\/products\/(\d+)$/);
  if (productIdMatch && method === "PUT") {
    await requireAdmin(request, env);
    const p = normalizeProduct(await request.json().catch(() => ({})));
    await env.DB.prepare(
      `UPDATE products SET name = ?, price = ?, discount_type = ?, discount_value = ?, available = ?, active = ?, updated_at = ?
       WHERE id = ?`
    ).bind(p.name, p.price, p.discount_type, p.discount_value, p.available, p.active, nowIso(), Number(productIdMatch[1])).run();
    return json({ id: Number(productIdMatch[1]), ...p });
  }
  if (productIdMatch && method === "DELETE") {
    await requireAdmin(request, env);
    await env.DB.prepare(`DELETE FROM products WHERE id = ?`).bind(Number(productIdMatch[1])).run();
    return json({ ok: true });
  }
  if (path === "/admin/settings" && method === "GET") {
    await requireAdmin(request, env);
    return json({ settings: await loadSettings(env, PUBLIC_SETTING_KEYS) });
  }
  if (path === "/admin/settings" && method === "PUT") {
    await requireAdmin(request, env);
    const body = await request.json().catch(() => ({}));
    const ts = nowIso();
    const current = await loadSettings(env, PUBLIC_SETTING_KEYS);
    const statements = [];
    for (const key of PUBLIC_SETTING_KEYS) {
      if (!body[key] || typeof body[key] !== "object")
        continue;
      const merged = sanitizeSettings(key, { ...current[key], ...body[key] });
      statements.push(
        env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`).bind(
          key,
          JSON.stringify(merged),
          ts
        )
      );
    }
    if (statements.length)
      await env.DB.batch(statements);
    return json({ settings: await loadSettings(env, PUBLIC_SETTING_KEYS) });
  }
  if (path === "/admin/password" && method === "POST") {
    await requireAdmin(request, env);
    const body = await request.json().catch(() => ({}));
    const current = String(body.current || "");
    const next = String(body.next || "");
    if (!await verifyAdminPassword(env, current))
      return fail(400, "Sandi lama tidak sesuai.");
    if (next.length < 6)
      return fail(400, "Sandi baru minimal 6 karakter.");
    await setAdminPassword(env, next);
    await env.DB.prepare(`DELETE FROM sessions`).run();
    return json({ ok: true });
  }
  if (path === "/admin/queue/reset" && method === "POST") {
    await requireAdmin(request, env);
    const ts = nowIso();
    await env.DB.batch([
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('queue_reset_at', ?)`).bind(ts),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('queue_reset_day', ?)`).bind(
        jakartaDateString()
      )
    ]);
    return json({ number: await nextQueueNumber(env) });
  }
  if (path === "/admin/transactions" && method === "GET") {
    await requireAdmin(request, env);
    const period = url.searchParams.get("period") === "monthly" ? "monthly" : "weekly";
    const anchor = url.searchParams.get("date") || jakartaDateString();
    const bounds = period === "monthly" ? monthBounds(anchor.slice(0, 7)) : weekBounds(anchor);
    const startIso = jakartaDayStartIso(bounds.start);
    const endIso = jakartaDayStartIso(bounds.end);
    const rows = await env.DB.prepare(
      `SELECT t.*,
        (SELECT GROUP_CONCAT(i.qty || 'x ' || i.name, ', ') FROM transaction_items i WHERE i.transaction_id = t.id) AS order_summary
       FROM transactions t
       WHERE t.created_at >= ? AND t.created_at < ?
       ORDER BY t.created_at DESC, t.id DESC`
    ).bind(startIso, endIso).all();
    const list = rows.results || [];
    const summary = list.reduce(
      (acc, t) => {
        if (t.status === "Selesai") {
          acc.selesai += 1;
          acc.omset += t.total;
          acc.diskon += t.discount_total;
        } else {
          acc.batal += 1;
          acc.nilai_batal += t.total;
        }
        return acc;
      },
      { selesai: 0, omset: 0, diskon: 0, batal: 0, nilai_batal: 0 }
    );
    return json({
      period,
      range: { start: bounds.start, end: addDays(bounds.end, -1) },
      summary,
      transactions: list
    });
  }
  const txnMatch = m(/^\/admin\/transactions\/(\d+)$/);
  if (txnMatch && method === "GET") {
    await requireAdmin(request, env);
    return json(await getTransaction(env, Number(txnMatch[1])));
  }
  const voidMatch = m(/^\/admin\/transactions\/(\d+)\/void$/);
  if (voidMatch && method === "POST") {
    await requireAdmin(request, env);
    const id = Number(voidMatch[1]);
    const txn = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ?`).bind(id).first();
    if (!txn)
      return fail(404, "Transaksi tidak ditemukan.");
    if (txn.status === "Batal")
      return json({ ok: true, status: "Batal" });
    await env.DB.prepare(`UPDATE transactions SET status = 'Batal', voided_at = ? WHERE id = ?`).bind(nowIso(), id).run();
    return json({ ok: true, status: "Batal" });
  }
  return fail(404, "Endpoint tidak ditemukan.");
}
__name(route, "route");
function normalizeProduct(input) {
  const name = String(input.name || "").trim().slice(0, 80);
  if (name.length < 2)
    throw Object.assign(new Error("Nama menu minimal 2 karakter."), { status: 400 });
  const price = Math.max(0, Math.round(Number(input.price) || 0));
  const discount_type = input.discount_type === "pct" ? "pct" : "rp";
  let discount_value = Math.max(0, Math.round(Number(input.discount_value) || 0));
  if (discount_type === "pct")
    discount_value = Math.min(100, discount_value);
  else
    discount_value = Math.min(price, discount_value);
  return {
    name,
    price,
    discount_type,
    discount_value,
    available: input.available ? 1 : 0,
    active: input.active ? 1 : 0
  };
}
__name(normalizeProduct, "normalizeProduct");
var HEX = /^#[0-9a-fA-F]{6}$/;
function sanitizeSettings(key, merged) {
  if (key === "theme") {
    const out2 = {};
    for (const [k, v] of Object.entries(merged))
      out2[k] = HEX.test(v) ? v : DEFAULT_SETTINGS.theme[k] || "#000000";
    return out2;
  }
  const limit = key === "receipt" ? 400 : 400;
  const out = {};
  for (const [k, v] of Object.entries(merged))
    out[k] = String(v ?? "").slice(0, limit);
  return out;
}
__name(sanitizeSettings, "sanitizeSettings");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-GAJN9z/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-GAJN9z/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  DEFAULT_SETTINGS,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
