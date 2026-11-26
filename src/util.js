export const rupiah = (value) =>
  'Rp ' + Math.round(Number(value) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });

export const rupiahPlain = (value) =>
  Math.round(Number(value) || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 });

export const padQueue = (n) => String(Math.max(0, Number(n) || 0)).padStart(3, '0');

/**
 * Nominal cepat uang tunai yang mengikuti total tagihan.
 * Semua nilai selalu di atas total agar tidak bertabrakan dengan "Uang Pas".
 */
export function quickCashOptions(total, max = 4) {
  const t = Math.max(0, Math.ceil(Number(total) || 0));
  if (!t) return [];

  const amounts = new Set();
  const steps = t >= 500000 ? [50000, 100000, 200000, 500000] : [10000, 20000, 50000, 100000];
  for (const step of steps) {
    let value = Math.ceil(t / step) * step;
    if (value <= t) value += step;
    amounts.add(value);
  }

  // Tagihan besar: tambah pecahan ratusan ribu berikutnya supaya tetap ada 4 pilihan.
  if (t >= 100000) {
    let next = Math.ceil(t / 100000) * 100000;
    let guard = 0;
    while (amounts.size < max && guard < 10) {
      next += 100000;
      amounts.add(next);
      guard += 1;
    }
  }

  return [...amounts].sort((a, b) => a - b).slice(0, max);
}

const JAKARTA_TZ = 'Asia/Jakarta';

export function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: JAKARTA_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateLong(dateStr) {
  // dateStr = YYYY-MM-DD interpreted as a Jakarta calendar day
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', {
    timeZone: JAKARTA_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr) {
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', { timeZone: JAKARTA_TZ, day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayJakarta() {
  const now = new Date();
  const shifted = new Date(now.getTime() + 7 * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function addMonths(monthStr, months) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(monthStr) {
  const d = new Date(`${monthStr}-01T00:00:00+07:00`);
  return d.toLocaleDateString('id-ID', { timeZone: JAKARTA_TZ, month: 'long', year: 'numeric' });
}

export function weekRangeLabel(start, end) {
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

export function isoDateOnly(iso) {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
