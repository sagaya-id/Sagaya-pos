import { buildReceipt } from '../receipt.js';

export default function Receipt({ txn, settings, printArea = false }) {
  const { rows } = buildReceipt(txn, settings);
  return (
    <div className={'receipt' + (printArea ? ' print-area' : '')}>
      {rows.map((row, i) => (
        <div
          key={i}
          className={'receipt-line' + (row.bold ? ' is-bold' : '') + (row.size === 'double' ? ' is-double' : '')}
        >
          {row.text === '' ? '\u00a0' : row.text}
        </div>
      ))}
    </div>
  );
}
