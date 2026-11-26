/**
 * Batagor Sagaya POS — Worker API
 * Serves the React SPA from env.ASSETS and a JSON API backed by D1 (env.DB).
 */

const ADMIN_COOKIE = 'bs_admin';
const SESSION_DAYS = 7;
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // Asia/Jakarta (WIB)
const DEFAULT_ADMIN_PASSWORD = 'sagaya2026';

export const DEFAULT_SETTINGS = {
  theme: {
    primary: '#F97316',
    primaryDark: '#EA580C',
    accent: '#EA580C',
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#0F172A',
    muted: '#64748B',
    headerText: '#0F172A',
    border: '#E2E8F0',
    success: '#16A34A',
    danger: '#DC2626',
    dangerSoft: '#FEF2F2',
  },
  texts: {
    storeName: 'Batagor Sagaya',
    navSubheader: 'Batagor & siomay hangat, dibuat segar setiap hari',
    heroBadge: 'Buka setiap hari · 09.00 – 21.00',
    landingTitle: 'Batagor renyah, siomay lembut, bumbu kacang juara.',
    landingDesc:
      'Pesan langsung di kasir, pilih menu favoritmu, dan bayar tunai atau QRIS. Nomor antrean tercetak otomatis di struk.',
    landingCta: 'Mulai Pesan',
    infoAddress: 'Jl. Sagaya Raya No. 12, Bandung',
    infoPhone: '0812-3456-7890',
    infoHours: 'Setiap hari 09.00 – 21.00',
    footerText: '© 2026 Batagor Sagaya · Terima kasih sudah mampir!',
    qrisImage: '',
  },
  receipt: {
    header1: 'BATAGOR SAGAYA',
    header2: 'Jl. Sagaya Raya No. 12, Bandung\nTelp 0812-3456-7890',
    footer1: 'Terima kasih atas kunjungan Anda',
    footer2: 'Barang yang sudah dibeli tidak dapat ditukar',
  },
};

const PUBLIC_SETTING_KEYS = ['theme', 'texts', 'receipt'];

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

const fail = (status, message) => json({ error: message }, status);

const nowIso = () => new Date().toISOString();

function jakartaDateString(d = new Date()) {
  return new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function jakartaDayStartIso(dateStr = jakartaDateString()) {
  return new Date(`${dateStr}T00:00:00.000+07:00`).toISOString();
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00.000+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Date(d.getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function monthBounds(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { start, end: nextMonth };
}

function weekBounds(dateStr) {
  // ISO week: Monday .. next Monday
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(dateStr, -dow);
  return { start: monday, end: addDays(monday, 7) };
}

/* ------------------------------------------------------------------ */
/* Schema + seed                                                       */
/* ------------------------------------------------------------------ */

let schemaReady = false;

const TABLE_SPECS = [
  {
    name: 'products',
    cols: ['name', 'price', 'discount_type', 'discount_value', 'available', 'active', 'created_at', 'updated_at'],
    ddl: `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Makanan',
      price INTEGER NOT NULL DEFAULT 0,
      discount_type TEXT NOT NULL DEFAULT 'rp',
      discount_value INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  },
  {
    name: 'settings',
    cols: ['key', 'value', 'updated_at'],
    ddl: `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  },
  {
    name: 'transactions',
    cols: [
      'queue_no', 'customer', 'order_type', 'note', 'method', 'subtotal', 'discount_total',
      'total', 'paid', 'change_amount', 'status', 'created_at', 'day', 'voided_at',
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
    )`,
  },
  {
    name: 'transaction_items',
    cols: ['transaction_id', 'product_id', 'name', 'qty', 'unit_price', 'discount_type', 'discount_value', 'discount_amount', 'subtotal'],
    ddl: `CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      product_id INTEGER,
      name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      qty INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'rp',
      discount_value INTEGER NOT NULL DEFAULT 0,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      subtotal INTEGER NOT NULL
    )`,
  },
  {
    name: 'sessions',
    cols: ['token', 'created_at', 'expires_at'],
    ddl: `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`,
  },
  {
    name: 'meta',
    cols: ['key', 'value'],
    ddl: `CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  },
];

/**
 * Membuat tabel bila belum ada. Bila tabel lama (versi aplikasi sebelumnya)
 * punya struktur berbeda: tabel kosong diganti, tabel berisi dipertahankan
 * dengan cara di-rename menjadi legacy_<nama>_<timestamp> agar data tidak hilang.
 */
async function ensureTable(env, spec) {
  const info = await env.DB.prepare(`PRAGMA table_info(${spec.name})`).all();
  const existing = (info.results || []).map((c) => c.name);
  if (!existing.length) {
    await env.DB.prepare(spec.ddl).run();
    return;
  }
  if (spec.cols.every((c) => existing.includes(c))) return;

  const count = await env.DB.prepare(`SELECT COUNT(*) AS c FROM ${spec.name}`).first();
  if (!count || !count.c) {
    await env.DB.prepare(`DROP TABLE ${spec.name}`).run();
    await env.DB.prepare(spec.ddl).run();
    return;
  }
  await env.DB.prepare(`ALTER TABLE ${spec.name} RENAME TO legacy_${spec.name}_${Date.now()}`).run();
  await env.DB.prepare(spec.ddl).run();
}

/**
 * Aplikasi versi sebelumnya menyimpan produk dengan id TEXT (UUID) dan tipe diskon
 * none/amount/percent. Migrasikan ke skema integer + tipe rp/pct tanpa kehilangan data.
 */
async function migrateLegacyProducts(env) {
  const done = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'products_migrated_v2'`).first();
  if (done) return;

  const info = await env.DB.prepare(`PRAGMA table_info(products)`).all();
  const cols = info.results || [];
  const idCol = cols.find((c) => c.name === 'id');
  const integerId = idCol && /INT/i.test(String(idCol.type || ''));

  if (integerId) {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE products SET discount_type = 'rp' WHERE discount_type IS NULL OR discount_type IN ('none', 'amount', 'fixed', '')`
      ),
      env.DB.prepare(
        `UPDATE products SET discount_type = 'pct' WHERE discount_type IN ('percent', 'percentage')`
      ),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('products_migrated_v2', ?)`).bind(nowIso()),
    ]);
    return;
  }

  await env.DB.prepare(`DROP TABLE IF EXISTS products_v2`).run();
  await env.DB.prepare(`CREATE TABLE products_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Makanan',
    price INTEGER NOT NULL DEFAULT 0,
    discount_type TEXT NOT NULL DEFAULT 'rp',
    discount_value INTEGER NOT NULL DEFAULT 0,
    available INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  const old = await env.DB.prepare(`SELECT * FROM products`).all();
  const seen = new Set();
  const stmts = [];
  for (const row of old.results || []) {
    if (row.id === null || row.id === undefined) continue; // sisa seed lama tanpa id
    const name = String(row.name || '').trim().slice(0, 80);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    const rawType = String(row.discount_type || '').toLowerCase();
    const type = ['percent', 'percentage', 'pct'].includes(rawType) ? 'pct' : 'rp';
    const price = Math.max(0, Math.round(Number(row.price) || 0));
    let value = Math.max(0, Math.round(Number(row.discount_value) || 0));
    value = type === 'pct' ? Math.min(100, value) : Math.min(price, value);
    const flag = (v) => (v === 0 || v === '0' || v === false ? 0 : 1);

    stmts.push(
      env.DB.prepare(
        `INSERT INTO products_v2 (name, price, discount_type, discount_value, available, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(name, price, type, value, flag(row.available), flag(row.active), row.created_at || nowIso(), nowIso())
    );
  }
  if (stmts.length) await env.DB.batch(stmts);

  await env.DB.prepare(`DROP TABLE products`).run();
  await env.DB.prepare(`ALTER TABLE products_v2 RENAME TO products`).run();
  await env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('products_migrated_v2', ?)`).bind(nowIso()).run();
}

/** Tambahkan kolom baru tanpa menghapus/rename tabel yang sudah berisi data. */
async function ensureColumn(env, table, column, definition) {
  const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const existing = (info.results || []).map((c) => c.name);
  if (existing.length && !existing.includes(column)) {
    await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

async function ensureSchema(env) {
  if (schemaReady) return;
  for (const spec of TABLE_SPECS) await ensureTable(env, spec);
  await ensureColumn(env, 'products', 'category', "TEXT NOT NULL DEFAULT 'Makanan'");
  await ensureColumn(env, 'transaction_items', 'note', "TEXT NOT NULL DEFAULT ''");
  await migrateLegacyProducts(env);

  const seeded = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'seeded'`).first();
  if (!seeded) {
    const ts = nowIso();
    const seeds = [
      ['Batagor Original', 'Makanan', 12000, 'rp', 0, 1, 1],
      ['Batagor Keju Mozzarella', 'Makanan', 18000, 'pct', 10, 1, 1],
      ['Siomay Ayam', 'Makanan', 10000, 'rp', 0, 1, 1],
      ['Siomay Udang', 'Makanan', 15000, 'rp', 2000, 1, 1],
      ['Batagor Frozen (isi 10)', 'Frozen', 45000, 'pct', 15, 1, 1],
      ['Es Teh Manis', 'Minuman', 6000, 'rp', 0, 1, 1],
      ['Es Jeruk', 'Minuman', 8000, 'rp', 0, 1, 1],
      ['Air Mineral', 'Minuman', 5000, 'rp', 0, 1, 1],
    ];
    await env.DB.batch([
      ...seeds.map(([name, category, price, dtype, dvalue, available, active]) =>
        env.DB.prepare(
          `INSERT INTO products (name, category, price, discount_type, discount_value, available, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(name, category, price, dtype, dvalue, available, active, ts, ts)
      ),
      ...Object.entries({
        theme: DEFAULT_SETTINGS.theme,
        texts: DEFAULT_SETTINGS.texts,
        receipt: DEFAULT_SETTINGS.receipt,
      }).map(([key, value]) =>
        env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`).bind(
          key,
          JSON.stringify(value),
          ts
        )
      ),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded', ?)`).bind(ts),
    ]);
  }
  await ensureAdminPassword(env);

  // Satu kali: terapkan palet oranye di atas latar slate sebagai warna bawaan tersimpan.
  // Setelah ini, kustomisasi warna manual dari admin tetap menang.
  const paletteV3 = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'theme_palette_v3'`).first();
  if (!paletteV3) {
    const ts = nowIso();
    await env.DB.batch([
      env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('theme', ?, ?)`).bind(
        JSON.stringify(DEFAULT_SETTINGS.theme),
        ts
      ),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('theme_palette_v3', ?)`).bind(ts),
    ]);
  }

  // Satu kali: isi kategori awal untuk menu yang dibuat sebelum ada kolom kategori.
  const categoriesSeeded = await env.DB.prepare(
    `SELECT value FROM meta WHERE key = 'product_categories_v1'`
  ).first();
  if (!categoriesSeeded) {
    await env.DB.batch([
      env.DB.prepare(`UPDATE products SET category = 'Makanan' WHERE category IS NULL OR category = ''`),
      env.DB.prepare(
        `UPDATE products SET category = 'Minuman' WHERE name IN ('Es Teh Manis', 'Es Jeruk', 'Air Mineral')`
      ),
      env.DB.prepare(`UPDATE products SET category = 'Frozen' WHERE name = 'Batagor Frozen (isi 10)'`),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('product_categories_v1', ?)`).bind(nowIso()),
    ]);
  }

  // Bersihkan sisa seed ganda bila proses seed sebelumnya terputus di tengah jalan.
  const deduped = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'seed_dedup_v1'`).first();
  if (!deduped) {
    const names = [
      'Batagor Original',
      'Batagor Keju Mozzarella',
      'Siomay Ayam',
      'Siomay Udang',
      'Batagor Frozen (isi 10)',
      'Es Teh Manis',
      'Es Jeruk',
      'Air Mineral',
    ];
    await env.DB.batch([
      ...names.map((name) =>
        env.DB.prepare(
          `DELETE FROM products WHERE name = ? AND id NOT IN (SELECT MIN(id) FROM products WHERE name = ?)`
        ).bind(name, name)
      ),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('seed_dedup_v1', ?)`).bind(nowIso()),
    ]);
  }

  schemaReady = true;
}

/* ------------------------------------------------------------------ */
/* Password + sessions                                                 */
/* ------------------------------------------------------------------ */

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function randomHex(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, saltHex) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 25000, hash: 'SHA-256' },
    key,
    256
  );
  return hex(bits);
}

async function setAdminPassword(env, password) {
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const ts = nowIso();
  await env.DB.batch([
    env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('admin_salt', ?)`).bind(salt),
    env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('admin_hash', ?)`).bind(hash),
    env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('admin_updated', ?)`).bind(ts),
  ]);
}

async function ensureAdminPassword(env) {
  const existing = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'admin_hash'`).first();
  if (!existing) await setAdminPassword(env, DEFAULT_ADMIN_PASSWORD);
}

async function verifyAdminPassword(env, password) {
  const row = await env.DB.prepare(
    `SELECT (SELECT value FROM meta WHERE key = 'admin_hash') AS hash, (SELECT value FROM meta WHERE key = 'admin_salt') AS salt`
  ).first();
  if (!row?.hash || !row?.salt) return false;
  const candidate = await hashPassword(password, row.salt);
  if (candidate.length !== row.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ row.hash.charCodeAt(i);
  return diff === 0;
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

async function currentSession(request, env) {
  const token = readCookie(request, ADMIN_COOKIE);
  if (!token) return null;
  const row = await env.DB.prepare(`SELECT * FROM sessions WHERE token = ?`).bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return null;
  }
  return row;
}

async function requireAdmin(request, env) {
  const session = await currentSession(request, env);
  if (!session) throw Object.assign(new Error('Sesi admin tidak valid. Silakan login ulang.'), { status: 401 });
  return session;
}

/* ------------------------------------------------------------------ */
/* Settings helpers                                                    */
/* ------------------------------------------------------------------ */

async function loadSettings(env, keys) {
  const placeholders = keys.map(() => '?').join(',');
  const rows = await env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`)
    .bind(...keys)
    .all();
  const out = {};
  for (const key of keys) out[key] = structuredClone(DEFAULT_SETTINGS[key] || {});
  for (const row of rows.results || []) {
    try {
      out[row.key] = { ...out[row.key], ...JSON.parse(row.value) };
    } catch {
      /* ignore broken rows */
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Queue + transaction math                                            */
/* ------------------------------------------------------------------ */

async function nextQueueNumber(env) {
  const today = jakartaDateString();
  const resetRow = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'queue_reset_day'`).first();
  const resetAtRow = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'queue_reset_at'`).first();
  const since =
    resetRow?.value === today && resetAtRow?.value ? resetAtRow.value : jakartaDayStartIso(today);
  const row = await env.DB.prepare(
    `SELECT MAX(queue_no) AS max_no FROM transactions WHERE created_at >= ?`
  )
    .bind(since)
    .first();
  return (row?.max_no || 0) + 1;
}

function discountPerUnit(price, type, value) {
  const v = Math.max(0, Math.round(Number(value) || 0));
  if (type === 'pct') return Math.min(price, Math.round((price * Math.min(v, 100)) / 100));
  return Math.min(price, v);
}

async function createTransaction(env, body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw Object.assign(new Error('Keranjang masih kosong.'), { status: 400 });

  const customer = String(body.customer || '').trim() || 'Pelanggan';
  const orderType = body.orderType === 'Take Away' ? 'Take Away' : 'Dine In';
  const note = String(body.note || '').trim().slice(0, 300);
  const method = body.method === 'QRIS' ? 'QRIS' : 'Tunai';

  const ids = [...new Set(items.map((it) => Number(it.productId || it.id)).filter(Boolean))];
  if (!ids.length) throw Object.assign(new Error('Produk tidak valid.'), { status: 400 });
  const rows = await env.DB.prepare(
    `SELECT * FROM products WHERE id IN (${ids.map(() => '?').join(',')})`
  )
    .bind(...ids)
    .all();
  const productMap = new Map((rows.results || []).map((p) => [p.id, p]));

  const lines = [];
  let subtotal = 0;
  let discountTotal = 0;

  for (const raw of items) {
    const product = productMap.get(Number(raw.productId || raw.id));
    const qty = Math.max(1, Math.min(999, Math.round(Number(raw.qty) || 1)));
    if (!product) throw Object.assign(new Error('Ada menu yang sudah tidak tersedia.'), { status: 400 });
    if (!product.active) throw Object.assign(new Error(`Menu "${product.name}" sedang nonaktif.`), { status: 400 });
    if (!product.available) throw Object.assign(new Error(`Menu "${product.name}" sedang habis.`), { status: 400 });

    const price = Number(product.price) || 0;
    const disc = discountPerUnit(price, product.discount_type, product.discount_value);
    const net = price - disc;
    subtotal += price * qty;
    discountTotal += disc * qty;
    lines.push({
      product_id: product.id,
      name: product.name,
      note: String(raw.note || '').trim().slice(0, 120),
      qty,
      unit_price: price,
      discount_type: product.discount_type,
      discount_value: Number(product.discount_value) || 0,
      discount_amount: disc,
      subtotal: net * qty,
    });
  }

  const total = subtotal - discountTotal;
  let paid = Math.round(Number(body.paid) || 0);
  if (method === 'QRIS') paid = total;
  if (paid < total) throw Object.assign(new Error('Uang diterima kurang dari total pembayaran.'), { status: 400 });
  const change = paid - total;

  const queueNo = await nextQueueNumber(env);
  const createdAt = nowIso();
  const day = jakartaDateString();

  const inserted = await env.DB.prepare(
    `INSERT INTO transactions
      (queue_no, customer, order_type, note, method, subtotal, discount_total, total, paid, change_amount, status, created_at, day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Selesai', ?, ?)`
  )
    .bind(queueNo, customer, orderType, note, method, subtotal, discountTotal, total, paid, change, createdAt, day)
    .run();

  const txnId = inserted.meta?.last_row_id;
  try {
    await env.DB.batch(
      lines.map((l) =>
        env.DB.prepare(
          `INSERT INTO transaction_items
            (transaction_id, product_id, name, note, qty, unit_price, discount_type, discount_value, discount_amount, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          txnId,
          l.product_id,
          l.name,
          l.note,
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

async function getTransaction(env, id) {
  const txn = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ?`).bind(id).first();
  if (!txn) throw Object.assign(new Error('Transaksi tidak ditemukan.'), { status: 404 });
  const items = await env.DB.prepare(`SELECT * FROM transaction_items WHERE transaction_id = ? ORDER BY id ASC`)
    .bind(id)
    .all();
  return { ...txn, items: items.results || [] };
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      await ensureSchema(env);
      return await route(request, env, url);
    } catch (err) {
      const status = err?.status || 500;
      if (status >= 500) console.error('API error', err?.stack || err);
      return json({ error: err?.message || 'Terjadi kesalahan pada server.' }, status);
    }
  },
};

async function route(request, env, url) {
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method.toUpperCase();
  const m = (re) => path.match(re);

  if (path === '/health') return json({ ok: true, time: nowIso() });

  /* ---------- public ---------- */
  if (path === '/bootstrap' && method === 'GET') {
    const settings = await loadSettings(env, PUBLIC_SETTING_KEYS);
    const products = await env.DB.prepare(
      `SELECT id, name, category, price, discount_type, discount_value, available, active
       FROM products WHERE active = 1 ORDER BY category ASC, id ASC`
    ).all();
    const queue = await nextQueueNumber(env);
    const authed = Boolean(await currentSession(request, env));
    return json({
      settings,
      products: products.results || [],
      queue,
      today: jakartaDateString(),
      authed,
    });
  }

  if (path === '/queue/next' && method === 'GET') {
    return json({ number: await nextQueueNumber(env), today: jakartaDateString() });
  }

  // Reset manual dari layar kasir (Langkah 1). Admin punya endpoint sendiri di bawah.
  if (path === '/queue/reset' && method === 'POST') {
    const ts = nowIso();
    await env.DB.batch([
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('queue_reset_at', ?)`).bind(ts),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('queue_reset_day', ?)`).bind(
        jakartaDateString()
      ),
    ]);
    return json({ number: await nextQueueNumber(env) });
  }

  if (path === '/transactions' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    return json(await createTransaction(env, body), 201);
  }

  /* ---------- admin auth ---------- */
  if (path === '/admin/session' && method === 'GET') {
    const session = await currentSession(request, env);
    return json({ authed: Boolean(session) });
  }

  if (path === '/admin/login' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const password = String(body.password || '');
    if (!password) return fail(400, 'Sandi admin wajib diisi.');
    const ok = await verifyAdminPassword(env, password);
    if (!ok) return fail(401, 'Sandi admin salah.');
    const token = randomHex(24);
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    await env.DB.prepare(`INSERT INTO sessions (token, created_at, expires_at) VALUES (?, ?, ?)`)
      .bind(token, nowIso(), expires)
      .run();
    const secure = url.protocol === 'https:' ? '; Secure' : '';
    return json(
      { authed: true },
      200,
      {
        'set-cookie': `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
          SESSION_DAYS * 86400
        }${secure}`,
      }
    );
  }

  if (path === '/admin/logout' && method === 'POST') {
    const token = readCookie(request, ADMIN_COOKIE);
    if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    return json({ authed: false }, 200, {
      'set-cookie': `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    });
  }

  /* ---------- admin: products ---------- */
  if (path === '/admin/products' && method === 'GET') {
    await requireAdmin(request, env);
    const rows = await env.DB.prepare(`SELECT * FROM products ORDER BY active DESC, id ASC`).all();
    return json({ products: rows.results || [] });
  }

  if (path === '/admin/products' && method === 'POST') {
    await requireAdmin(request, env);
    const p = normalizeProduct(await request.json().catch(() => ({})));
    const ts = nowIso();
    const res = await env.DB.prepare(
      `INSERT INTO products (name, category, price, discount_type, discount_value, available, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(p.name, p.category, p.price, p.discount_type, p.discount_value, p.available, p.active, ts, ts)
      .run();
    return json({ id: res.meta?.last_row_id, ...p }, 201);
  }

  const productIdMatch = m(/^\/admin\/products\/(\d+)$/);
  if (productIdMatch && method === 'PUT') {
    await requireAdmin(request, env);
    const p = normalizeProduct(await request.json().catch(() => ({})));
    await env.DB.prepare(
      `UPDATE products SET name = ?, category = ?, price = ?, discount_type = ?, discount_value = ?, available = ?, active = ?, updated_at = ?
       WHERE id = ?`
    )
      .bind(
        p.name,
        p.category,
        p.price,
        p.discount_type,
        p.discount_value,
        p.available,
        p.active,
        nowIso(),
        Number(productIdMatch[1])
      )
      .run();
    return json({ id: Number(productIdMatch[1]), ...p });
  }

  if (productIdMatch && method === 'DELETE') {
    await requireAdmin(request, env);
    await env.DB.prepare(`DELETE FROM products WHERE id = ?`).bind(Number(productIdMatch[1])).run();
    return json({ ok: true });
  }

  /* ---------- admin: settings ---------- */
  if (path === '/admin/settings' && method === 'GET') {
    await requireAdmin(request, env);
    return json({ settings: await loadSettings(env, PUBLIC_SETTING_KEYS) });
  }

  if (path === '/admin/settings' && method === 'PUT') {
    await requireAdmin(request, env);
    const body = await request.json().catch(() => ({}));
    const ts = nowIso();
    const current = await loadSettings(env, PUBLIC_SETTING_KEYS);
    const statements = [];
    for (const key of PUBLIC_SETTING_KEYS) {
      if (!body[key] || typeof body[key] !== 'object') continue;
      const merged = sanitizeSettings(key, { ...current[key], ...body[key] });
      statements.push(
        env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`).bind(
          key,
          JSON.stringify(merged),
          ts
        )
      );
    }
    if (statements.length) await env.DB.batch(statements);
    return json({ settings: await loadSettings(env, PUBLIC_SETTING_KEYS) });
  }

  /* ---------- admin: password + queue ---------- */
  if (path === '/admin/password' && method === 'POST') {
    await requireAdmin(request, env);
    const body = await request.json().catch(() => ({}));
    const current = String(body.current || '');
    const next = String(body.next || '');
    if (!(await verifyAdminPassword(env, current))) return fail(400, 'Sandi lama tidak sesuai.');
    if (next.length < 6) return fail(400, 'Sandi baru minimal 6 karakter.');
    await setAdminPassword(env, next);
    await env.DB.prepare(`DELETE FROM sessions`).run();
    return json({ ok: true });
  }

  if (path === '/admin/queue/reset' && method === 'POST') {
    await requireAdmin(request, env);
    const ts = nowIso();
    await env.DB.batch([
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('queue_reset_at', ?)`).bind(ts),
      env.DB.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('queue_reset_day', ?)`).bind(
        jakartaDateString()
      ),
    ]);
    return json({ number: await nextQueueNumber(env) });
  }

  /* ---------- admin: transactions / recap ---------- */
  if (path === '/admin/transactions' && method === 'GET') {
    await requireAdmin(request, env);
    const period = url.searchParams.get('period') === 'monthly' ? 'monthly' : 'weekly';
    const anchor = url.searchParams.get('date') || jakartaDateString();
    const bounds =
      period === 'monthly' ? monthBounds(anchor.slice(0, 7)) : weekBounds(anchor);
    const startIso = jakartaDayStartIso(bounds.start);
    const endIso = jakartaDayStartIso(bounds.end);

    const rows = await env.DB.prepare(
      `SELECT t.*,
        (SELECT GROUP_CONCAT(i.qty || 'x ' || i.name, char(10)) FROM transaction_items i WHERE i.transaction_id = t.id) AS order_summary
       FROM transactions t
       WHERE t.created_at >= ? AND t.created_at < ?
       ORDER BY t.created_at DESC, t.id DESC`
    )
      .bind(startIso, endIso)
      .all();

    const list = rows.results || [];
    const summary = list.reduce(
      (acc, t) => {
        if (t.status === 'Selesai') {
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
      transactions: list,
    });
  }

  const txnMatch = m(/^\/admin\/transactions\/(\d+)$/);
  if (txnMatch && method === 'GET') {
    await requireAdmin(request, env);
    return json(await getTransaction(env, Number(txnMatch[1])));
  }

  const voidMatch = m(/^\/admin\/transactions\/(\d+)\/void$/);
  if (voidMatch && method === 'POST') {
    await requireAdmin(request, env);
    const id = Number(voidMatch[1]);
    const txn = await env.DB.prepare(`SELECT * FROM transactions WHERE id = ?`).bind(id).first();
    if (!txn) return fail(404, 'Transaksi tidak ditemukan.');
    if (txn.status === 'Batal') return json({ ok: true, status: 'Batal' });
    await env.DB.prepare(`UPDATE transactions SET status = 'Batal', voided_at = ? WHERE id = ?`)
      .bind(nowIso(), id)
      .run();
    return json({ ok: true, status: 'Batal' });
  }

  return fail(404, 'Endpoint tidak ditemukan.');
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function normalizeProduct(input) {
  const name = String(input.name || '').trim().slice(0, 80);
  if (name.length < 2) throw Object.assign(new Error('Nama menu minimal 2 karakter.'), { status: 400 });
  const category = String(input.category || 'Makanan').trim().slice(0, 40) || 'Makanan';
  const price = Math.max(0, Math.round(Number(input.price) || 0));
  const discount_type = input.discount_type === 'pct' ? 'pct' : 'rp';
  let discount_value = Math.max(0, Math.round(Number(input.discount_value) || 0));
  if (discount_type === 'pct') discount_value = Math.min(100, discount_value);
  else discount_value = Math.min(price, discount_value);
  return {
    name,
    category,
    price,
    discount_type,
    discount_value,
    available: input.available ? 1 : 0,
    active: input.active ? 1 : 0,
  };
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function sanitizeSettings(key, merged) {
  if (key === 'theme') {
    const out = {};
    for (const [k, v] of Object.entries(merged)) out[k] = HEX.test(v) ? v : DEFAULT_SETTINGS.theme[k] || '#000000';
    return out;
  }
  const out = {};
  for (const [k, v] of Object.entries(merged)) {
    const limit = k === 'qrisImage' ? 700000 : 400;
    out[k] = String(v ?? '').slice(0, limit);
  }
  return out;
}
