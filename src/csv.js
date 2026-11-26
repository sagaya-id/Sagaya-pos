import { formatDateTime } from './util.js';

export const RECAP_COLUMNS = [
  { key: 'no', label: 'No' },
  { key: 'queue', label: 'No Antrean' },
  { key: 'customer', label: 'Nama' },
  { key: 'order', label: 'Pesanan' },
  { key: 'method', label: 'Metode Transaksi' },
  { key: 'datetime', label: 'Tanggal & Jam' },
  { key: 'discount', label: 'Total Diskon' },
  { key: 'total', label: 'Total Bayar' },
  { key: 'status', label: 'Status' },
];

const csvCell = (value) => {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
};

const money = (n) => Math.round(Number(n) || 0).toLocaleString('id-ID');

export function recapRows(transactions) {
  return transactions.map((t, index) => ({
    no: index + 1,
    queue: String(t.queue_no).padStart(3, '0'),
    customer: t.customer,
    // Satu transaksi tetap satu baris Excel: item dipisah titik koma di dalam sel.
    order: t.order_summary
      ? String(t.order_summary)
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .join('; ')
      : '-',
    method: t.method,
    datetime: formatDateTime(t.created_at),
    discount: money(t.discount_total),
    total: money(t.total),
    status: t.status,
  }));
}

/**
 * CSV dengan BOM + pemisah titik koma agar rapi dibuka di Excel (Indonesia/region EU-ID).
 */
export function buildRecapCsv(transactions, meta = {}) {
  const rows = recapRows(transactions);
  const header = RECAP_COLUMNS.map((c) => csvCell(c.label)).join(';');
  const body = rows.map((r) => RECAP_COLUMNS.map((c) => csvCell(r[c.key])).join(';'));

  const info = [
    [csvCell('Rekap Pesanan Batagor Sagaya')],
    [csvCell(`Periode: ${meta.periodLabel || '-'}`)],
    [csvCell(`Dibuat: ${formatDateTime(new Date().toISOString())}`)],
    [],
  ].map((line) => line.join(';'));

  return '\uFEFF' + [...info, header, ...body].join('\r\n') + '\r\n';
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
