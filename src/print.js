import { buildReceipt } from './receipt.js';
import { printRows, connectPrinter, printerStatus } from './printer.js';

export function printViaDialog() {
  window.print();
}

/** Cetak struk transaksi; menyambungkan printer dulu bila belum terhubung. */
export async function printTransaction(txn, settings) {
  if (!printerStatus().connected) await connectPrinter();
  const { rows } = buildReceipt(txn, settings);
  await printRows(rows);
}
