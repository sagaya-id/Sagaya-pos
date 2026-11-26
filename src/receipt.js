/**
 * Struk thermal 58mm — satu sumber format untuk preview layar dan cetak Bluetooth.
 * Lebar kertas 58mm ≈ 32 karakter monospace per baris.
 * Satu cetakan berisi 2 rangkap (pelanggan + salinan dapur/bukti kasir) dipisah garis sobek.
 */
import { rupiah, rupiahPlain, padQueue, formatDateTime } from './util.js';

export const RECEIPT_WIDTH = 32;
export const TEAR_LABEL = '-- SOBEK DI SINI --';

/** Word-wrap utuh: tidak memotong dengan elipsis, kata panjang dipecah per karakter. */
export function wrapText(text, width) {
  const words = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const lines = [];
  let line = '';

  const pushLongWord = (word) => {
    let rest = word;
    while (rest.length > width) {
      lines.push(rest.slice(0, width));
      rest = rest.slice(width);
    }
    return rest;
  };

  for (const word of words) {
    if (!line) {
      line = word.length > width ? pushLongWord(word) : word;
    } else if (line.length + 1 + word.length <= width) {
      line += ' ' + word;
    } else {
      lines.push(line);
      line = word.length > width ? pushLongWord(word) : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

const center = (text, width = RECEIPT_WIDTH) => {
  const t = text.length > width ? text.slice(0, width) : text;
  const left = Math.max(0, Math.floor((width - t.length) / 2));
  return (' '.repeat(left) + t).padEnd(width, ' ');
};

const kv = (label, value, width = RECEIPT_WIDTH) => {
  const v = String(value ?? '');
  if (label.length + v.length + 1 <= width) return label + ' '.repeat(width - label.length - v.length) + v;
  const wrapped = wrapText(v, Math.max(8, width - label.length - 1));
  return [label + wrapped[0], ...wrapped.slice(1).map((l) => ' '.repeat(label.length) + l)];
};

const separator = (char = '-') => char.repeat(RECEIPT_WIDTH);

/** Baris item struk pelanggan: Nama | Qty | Subtotal, diskon polos di bawah item. */
function itemLines(item) {
  const nameWidth = RECEIPT_WIDTH - 4 - 11;
  const nameParts = wrapText(item.name, nameWidth);
  const qty = String(item.qty);
  const price = rupiahPlain(item.subtotal);
  const rows = [];

  rows.push(
    nameParts[0].padEnd(nameWidth, ' ') + center(qty, 4) + price.padStart(11, ' ')
  );
  for (const part of nameParts.slice(1)) rows.push('  ' + part);

  if (item.note) {
    for (const line of wrapText(`Catatan: ${item.note}`, RECEIPT_WIDTH - 2)) rows.push('  ' + line);
  }

  if (item.discount_amount > 0) {
    const note =
      item.discount_type === 'pct'
        ? `(Promo Diskon ${item.discount_value}%)`
        : `(Hemat ${rupiah(item.discount_amount * item.qty)})`;
    for (const line of wrapText(note, RECEIPT_WIDTH - 2)) rows.push('  ' + line);
  }
  return rows;
}

/** Baris item salinan dapur: qty x nama + catatan, tanpa harga. */
function kitchenItemLines(item) {
  const prefix = `${item.qty}x`;
  const nameWidth = RECEIPT_WIDTH - prefix.length - 1;
  const parts = wrapText(item.name, nameWidth);
  const rows = [prefix + ' ' + parts[0]];

  for (const part of parts.slice(1)) rows.push(' '.repeat(prefix.length + 1) + part);
  if (item.note) {
    for (const line of wrapText(`* ${item.note}`, RECEIPT_WIDTH - 2)) rows.push('  ' + line);
  }
  return rows;
}

/**
 * @returns {{ text: string, align: 'left'|'center', bold?: boolean, size?: 'normal'|'double', mono?: boolean }[]}
 */
export function buildReceipt(txn, settings) {
  const receipt = settings?.receipt || {};
  const rows = [];
  const push = (text, opts = {}) => rows.push({ align: 'left', size: 'normal', ...opts, text });
  const pushCentered = (value, opts = {}) => {
    for (const raw of String(value ?? '').split('\n')) {
      for (const line of wrapText(raw, RECEIPT_WIDTH)) push(center(line), { align: 'center', ...opts });
    }
  };

  const header1 = String(receipt.header1 || '').trim();
  const header2 = String(receipt.header2 || '').trim();
  const footer1 = String(receipt.footer1 || '').trim();
  const footer2 = String(receipt.footer2 || '').trim();
  const items = txn.items || [];

  // ================= Bagian 1: STRUK PELANGGAN =================
  if (header1) pushCentered(header1, { bold: true });
  if (header2) pushCentered(header2);

  push(separator('='));

  const meta = [
    ['No. Antrean', `#${padQueue(txn.queue_no)}`],
    ['Nama', txn.customer],
    ['Tipe', txn.order_type],
    ['Metode', txn.method],
    ['Waktu', formatDateTime(txn.created_at)],
  ];
  for (const [label, value] of meta) {
    const line = kv(label, value);
    (Array.isArray(line) ? line : [line]).forEach((l) => push(l));
  }
  if (txn.note) {
    for (const line of wrapText(`Catatan: ${txn.note}`, RECEIPT_WIDTH)) push(line);
  }

  push(separator('-'));

  for (const item of items) itemLines(item).forEach((l) => push(l));

  push(separator('-'));
  const totals = [
    ['Subtotal', rupiah(txn.subtotal)],
    ['Diskon', txn.discount_total > 0 ? '-' + rupiah(txn.discount_total) : rupiah(0)],
    ['TOTAL', rupiah(txn.total)],
    ['Bayar', rupiah(txn.paid)],
    ['Kembali', rupiah(txn.change_amount)],
  ];
  for (const [label, value] of totals) {
    const line = kv(label, value);
    (Array.isArray(line) ? line : [line]).forEach((l) => push(l, { bold: label === 'TOTAL' }));
  }

  push(separator('='));
  if (footer1) pushCentered(footer1);
  if (footer2) pushCentered(footer2);

  // ================= GARIS SOBEK =================
  push('');
  push(separator('-'));
  push(center(TEAR_LABEL), { align: 'center', bold: true });
  push(separator('-'));
  push('');

  // ============ Bagian 2: SALINAN DAPUR / BUKTI KASIR ============
  pushCentered('SALINAN DAPUR / BUKTI KASIR', { bold: true });
  push(separator('='));

  const copyMeta = [
    ['No. Antrean', `#${padQueue(txn.queue_no)}`],
    ['Nama', txn.customer],
    ['Tipe', txn.order_type],
    ['Waktu', formatDateTime(txn.created_at)],
  ];
  for (const [label, value] of copyMeta) {
    const line = kv(label, value);
    (Array.isArray(line) ? line : [line]).forEach((l) => push(l));
  }
  if (txn.note) {
    for (const line of wrapText(`Catatan: ${txn.note}`, RECEIPT_WIDTH)) push(line);
  }

  push(separator('-'));
  for (const item of items) kitchenItemLines(item).forEach((l) => push(l));
  push(separator('-'));

  const totalLine = kv('TOTAL', rupiah(txn.total));
  (Array.isArray(totalLine) ? totalLine : [totalLine]).forEach((l) => push(l, { bold: true }));

  push(separator('='));

  const text = rows.map((r) => r.text).join('\n');
  return { rows, text };
}

/** Placeholder transaksi untuk preview di panel admin. */
export function sampleTransaction(settings) {
  return {
    id: 1,
    queue_no: 12,
    customer: 'Pelanggan Contoh',
    order_type: 'Dine In',
    note: '',
    method: 'Tunai',
    created_at: new Date().toISOString(),
    subtotal: 42000,
    discount_total: 3600,
    total: 38400,
    paid: 50000,
    change_amount: 11600,
    items: [
      {
        name: 'Batagor Keju Mozzarella Spesial',
        qty: 2,
        unit_price: 18000,
        discount_type: 'pct',
        discount_value: 10,
        discount_amount: 1800,
        subtotal: 32400,
      },
      {
        name: 'Es Teh Manis',
        qty: 1,
        unit_price: 6000,
        discount_type: 'rp',
        discount_value: 0,
        discount_amount: 0,
        subtotal: 6000,
      },
    ],
    settings,
  };
}
