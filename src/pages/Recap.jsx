import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { rupiah, padQueue, formatDateTime, todayJakarta, addDays, addMonths, monthLabel, weekRangeLabel } from '../util.js';
import { RECAP_COLUMNS, buildRecapCsv, downloadCsv } from '../csv.js';
import Receipt from '../components/Receipt.jsx';
import { printRows, connectPrinter, printerStatus } from '../printer.js';
import { buildReceipt } from '../receipt.js';
import { printViaDialog } from '../print.js';

export default function Recap({ settings }) {
  const [period, setPeriod] = useState('weekly');
  const [anchor, setAnchor] = useState(todayJakarta());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTxn, setActiveTxn] = useState(null);
  const [printMsg, setPrintMsg] = useState('');

  const queryDate = period === 'monthly' ? `${anchor.slice(0, 7)}-01` : anchor;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .transactions({ period, date: queryDate })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, queryDate]);

  const rangeLabel = useMemo(() => {
    if (!data) return '';
    if (data.period === 'weekly') return `Minggu ${weekRangeLabel(data.range.start, data.range.end)}`;
    return monthLabel(data.range.start.slice(0, 7));
  }, [data]);

  const move = (dir) => {
    if (period === 'weekly') setAnchor(addDays(anchor, dir * 7));
    else setAnchor(`${addMonths(anchor.slice(0, 7), dir)}-01`);
  };

  const transactions = data?.transactions || [];
  const summary = data?.summary || { selesai: 0, omset: 0, diskon: 0, batal: 0, nilai_batal: 0 };

  const exportCsv = () => {
    if (!transactions.length) return;
    const csv = buildRecapCsv(transactions, {
      periodLabel: `${rangeLabel} (${data.range.start} s/d ${data.range.end})`,
    });
    downloadCsv(`rekap-batagor-sagaya-${data.range.start}_${data.range.end}.csv`, csv);
  };

  const voidTxn = async (txn) => {
    if (!window.confirm(`Batalkan transaksi antrean #${padQueue(txn.queue_no)} (${txn.customer})? Transaksi akan ditandai Batal dan tidak dihitung ke omset.`)) {
      return;
    }
    try {
      await api.voidTransaction(txn.id);
      setNotice(`Transaksi #${padQueue(txn.queue_no)} dibatalkan.`);
      const res = await api.transactions({ period, date: queryDate });
      setData(res);
    } catch (err) {
      setError(err.message);
    }
  };

  const openReceipt = async (txn) => {
    setPrintMsg('');
    try {
      const full = await api.transaction(txn.id);
      setActiveTxn(full);
    } catch (err) {
      setError(err.message);
    }
  };

  const printActive = async () => {
    if (!activeTxn) return;
    setPrintMsg('');
    try {
      if (!printerStatus().connected) await connectPrinter();
      const { rows } = buildReceipt(activeTxn, settings);
      await printRows(rows);
      setPrintMsg('Struk dikirim ke printer.');
    } catch (err) {
      setPrintMsg(err.message);
    }
  };

  return (
    <section className="admin-panel">
      <div className="panel-head wrap">
        <div>
          <h2>Rekap Pesanan</h2>
          <p className="hint">Data langsung dari database — transaksi Batal tidak masuk omset bersih.</p>
        </div>
        <div className="segmented">
          <button className={period === 'weekly' ? 'is-active' : ''} onClick={() => setPeriod('weekly')}>
            Mingguan
          </button>
          <button className={period === 'monthly' ? 'is-active' : ''} onClick={() => setPeriod('monthly')}>
            Bulanan
          </button>
        </div>
      </div>

      <div className="period-bar">
        <button className="btn btn-outline btn-sm" onClick={() => move(-1)} aria-label="Periode sebelumnya">
          ←
        </button>
        <div className="period-label">
          <strong>{rangeLabel || '—'}</strong>
          {data && (
            <span className="hint">
              {data.range.start} s/d {data.range.end} · {period === 'weekly' ? 'Senin–Minggu' : 'satu bulan penuh'}
            </span>
          )}
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => move(1)} aria-label="Periode berikutnya">
          →
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setAnchor(todayJakarta())}>
          Hari ini
        </button>
        <button className="btn btn-primary btn-sm" onClick={exportCsv} disabled={!transactions.length}>
          Ekspor Excel (.csv)
        </button>
      </div>

      {notice && <div className="alert alert-info">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="summary-grid">
        <div className="summary-card">
          <span>Transaksi selesai</span>
          <strong>{summary.selesai}</strong>
        </div>
        <div className="summary-card is-accent">
          <span>Omset bersih</span>
          <strong>{rupiah(summary.omset)}</strong>
        </div>
        <div className="summary-card">
          <span>Total diskon</span>
          <strong>{rupiah(summary.diskon)}</strong>
        </div>
        <div className="summary-card is-danger">
          <span>Transaksi batal</span>
          <strong>{summary.batal}</strong>
          <small>{summary.batal ? `Nilai ${rupiah(summary.nilai_batal)}` : 'Tidak ada pembatalan'}</small>
        </div>
      </div>

      {loading ? (
        <div className="empty">Memuat rekap…</div>
      ) : transactions.length === 0 ? (
        <div className="empty">Belum ada transaksi pada periode ini.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {RECAP_COLUMNS.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={t.id} className={t.status === 'Batal' ? 'is-void' : ''}>
                    <td>{i + 1}</td>
                    <td>#{padQueue(t.queue_no)}</td>
                    <td>{t.customer}</td>
                    <td className="cell-orders">
                      <div className="order-list">
                        {(t.order_summary
                          ? String(t.order_summary).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
                          : ['-']
                        ).map((line, idx) => (
                          <span key={idx}>{line}</span>
                        ))}
                      </div>
                    </td>
                    <td>{t.method}</td>
                    <td className="cell-nowrap">{formatDateTime(t.created_at)}</td>
                    <td>{rupiah(t.discount_total)}</td>
                    <td>{rupiah(t.total)}</td>
                    <td>
                      <span className={'status-pill' + (t.status === 'Batal' ? ' is-void' : '')}>{t.status}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-outline btn-xs" onClick={() => openReceipt(t)}>
                          Struk
                        </button>
                        {t.status === 'Selesai' && (
                          <button className="btn btn-danger-ghost btn-xs" onClick={() => voidTxn(t)}>
                            Batalkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint small-note">
            Geser tabel ke samping di layar kecil. Urutan kolom sama persis dengan file Excel (.csv) yang diekspor.
          </p>
        </>
      )}

      {activeTxn && (
        <div className="modal-backdrop" onClick={() => setActiveTxn(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Struk Antrean #{padQueue(activeTxn.queue_no)}</h3>
              <button className="icon-btn" onClick={() => setActiveTxn(null)} aria-label="Tutup">
                ×
              </button>
            </div>
            {activeTxn.status === 'Batal' && <div className="alert alert-error">Transaksi ini berstatus Batal.</div>}
            <div className="receipt-paper">
              <Receipt txn={activeTxn} settings={settings} printArea />
            </div>
            {printMsg && <div className="alert alert-info">{printMsg}</div>}
            <div className="row-actions">
              <button className="btn btn-primary" onClick={printActive}>
                Cetak Bluetooth
              </button>
              <button className="btn btn-outline" onClick={printViaDialog}>
                Cetak lewat dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
