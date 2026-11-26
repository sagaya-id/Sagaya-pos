import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { rupiah, padQueue, quickCashOptions } from '../util.js';
import Receipt from '../components/Receipt.jsx';
import { printRows, connectPrinter, printerStatus, onPrinterChange, testPrintRows } from '../printer.js';
import { buildReceipt } from '../receipt.js';
import { printViaDialog } from '../print.js';

const STEPS = [
  { id: 1, label: 'Antrean & Nama' },
  { id: 2, label: 'Pilih Menu' },
  { id: 3, label: 'Rekap Pesanan' },
  { id: 4, label: 'Bayar & Struk' },
];

const formatThousands = (digits) => (digits ? Number(digits).toLocaleString('id-ID') : '');

function discountText(product) {
  if (!product.discount_value) return '';
  if (product.discount_type === 'pct') return `Diskon ${product.discount_value}%`;
  return `Hemat ${rupiah(product.discount_value)}`;
}

function unitNet(product) {
  const price = Number(product.price) || 0;
  const v = Number(product.discount_value) || 0;
  const cut = product.discount_type === 'pct' ? Math.round((price * Math.min(v, 100)) / 100) : Math.min(price, v);
  return Math.max(0, price - cut);
}

const categoryOf = (product) => product.category || 'Makanan';

export default function Kasir({ settings, products, queue, refresh, onHome, onAdmin }) {
  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState('');
  const [orderType, setOrderType] = useState('Dine In');
  const [orderNote, setOrderNote] = useState('');
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Semua');
  const [method, setMethod] = useState('Tunai');
  const [paidDigits, setPaidDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [queueMsg, setQueueMsg] = useState('');
  const [txn, setTxn] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [itemDraft, setItemDraft] = useState(null);
  const [mobileTab, setMobileTab] = useState('menu');
  const [printer, setPrinter] = useState(printerStatus());
  const [printMsg, setPrintMsg] = useState('');

  useEffect(() => onPrinterChange(setPrinter), []);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const categories = useMemo(
    () => ['Semua', ...new Set(products.map((p) => categoryOf(p)))],
    [products]
  );

  const cartLines = cart
    .map((line) => {
      const product = productMap.get(line.id);
      if (!product) return null;
      const net = unitNet(product);
      return {
        ...line,
        product,
        price: Number(product.price) || 0,
        net,
        discountPerUnit: (Number(product.price) || 0) - net,
        subtotal: net * line.qty,
      };
    })
    .filter(Boolean);

  const subtotal = cartLines.reduce((s, l) => s + l.price * l.qty, 0);
  const discountTotal = cartLines.reduce((s, l) => s + l.discountPerUnit * l.qty, 0);
  const total = subtotal - discountTotal;
  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  const paidValue = method === 'QRIS' ? total : Number(paidDigits) || 0;
  const change = Math.max(0, paidValue - total);
  const notEnough = method === 'Tunai' && paidValue < total;
  const quickCash = useMemo(() => quickCashOptions(total), [total]);

  const filtered = products.filter((p) => {
    if (category !== 'Semua' && categoryOf(p) !== category) return false;
    if (!search.trim()) return true;
    return p.name.toLowerCase().includes(search.trim().toLowerCase());
  });

  const openItem = (product) => {
    if (!product.available) return;
    setError('');
    setItemDraft({ product, qty: 1, note: '' });
  };

  const commitItem = () => {
    if (!itemDraft) return;
    const qty = Math.max(1, Math.min(99, Number(itemDraft.qty) || 1));
    const note = itemDraft.note.trim();
    const key = `${itemDraft.product.id}::${note}`;
    setCart((prev) => {
      const found = prev.findIndex((l) => l.key === key);
      if (found >= 0) {
        const next = [...prev];
        next[found] = { ...next[found], qty: Math.min(99, next[found].qty + qty) };
        return next;
      }
      return [...prev, { key, id: itemDraft.product.id, qty, note }];
    });
    setItemDraft(null);
  };

  const changeQty = (key, delta) => {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  };

  const removeItem = (key) => setCart((prev) => prev.filter((l) => l.key !== key));

  const goStep = (next) => {
    setError('');
    if (next === 2 && !customer.trim()) return setError('Nama pelanggan wajib diisi sebelum lanjut.');
    if ((next === 3 || next === 4) && !cartLines.length) return setError('Pilih minimal satu menu dulu.');
    setStep(next);
    if (next === 2) setMobileTab('menu');
  };

  const resetQueue = async () => {
    if (!window.confirm('Reset nomor antrean hari ini ke #001?')) return;
    setError('');
    try {
      const res = await api.resetQueuePublic();
      setQueueMsg(`Nomor antrean direset. Antrean berikutnya #${padQueue(res.number)}.`);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const submitPayment = async () => {
    if (!cartLines.length) return setError('Keranjang masih kosong.');
    if (notEnough) return setError('Uang diterima belum mencukupi total pembayaran.');
    setBusy(true);
    setError('');
    try {
      const order = await api.createOrder({
        customer: customer.trim(),
        orderType,
        note: orderNote.trim(),
        method,
        paid: method === 'QRIS' ? total : paidValue,
        items: cartLines.map((l) => ({ productId: l.id, qty: l.qty, note: l.note })),
      });
      setTxn(order);
      setReceiptOpen(true);
      setStep(4);
      setPrintMsg('');
      try {
        await refresh();
      } catch {
        /* data tetap aman di database */
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startNew = () => {
    setTxn(null);
    setReceiptOpen(false);
    setStep(1);
    setCart([]);
    setCustomer('');
    setOrderNote('');
    setOrderType('Dine In');
    setMethod('Tunai');
    setPaidDigits('');
    setError('');
    setQueueMsg('');
    setPrintMsg('');
    setMobileTab('menu');
  };

  const handleBluetoothPrint = async () => {
    if (!txn) return;
    setPrintMsg('');
    try {
      if (!printer.connected) await connectPrinter();
      const { rows } = buildReceipt(txn, settings);
      await printRows(rows);
      setPrintMsg('Struk berhasil dikirim ke printer.');
    } catch (err) {
      setPrintMsg(err.message || 'Gagal mencetak.');
    }
  };

  const testPrint = async () => {
    setPrintMsg('');
    try {
      if (!printer.connected) await connectPrinter();
      await printRows(testPrintRows());
      setPrintMsg('Uji cetak terkirim.');
    } catch (err) {
      setPrintMsg(err.message);
    }
  };

  const qrisImage = settings?.texts?.qrisImage || '';

  return (
    <div className="app-shell">
      <header className="posbar">
        <div className="brand">
          <span className="brand-mark">BS</span>
          <div className="brand-text">
            <strong>{settings.texts.storeName}</strong>
            <span>Kasir · {settings.texts.navSubheader}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={onHome}>
            Beranda
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onAdmin}>
            Admin
          </button>
        </div>
      </header>

      <ol className="steps">
        {STEPS.map((s) => (
          <li
            key={s.id}
            className={'step' + (step === s.id ? ' is-active' : '') + (step > s.id ? ' is-done' : '')}
            aria-current={step === s.id ? 'step' : undefined}
          >
            <span className="step-no">{step > s.id ? '✓' : s.id}</span>
            <span className="step-label">{s.label}</span>
          </li>
        ))}
      </ol>

      {error && <div className="alert alert-error">{error}</div>}

      {step === 1 && (
        <section className="panel step1">
          <div className="step1-queue">
            <span className="eyebrow">Nomor Antrean</span>
            <div className="queue-big">#{padQueue(queue)}</div>
            <p className="hint">Nomor otomatis, reset sendiri setiap ganti hari.</p>
            <button className="btn btn-ghost btn-sm queue-reset" onClick={resetQueue}>
              Reset No. Antrean
            </button>
            {queueMsg && <p className="hint queue-msg">{queueMsg}</p>}
          </div>
          <div className="step1-form">
            <h2>Identitas Pesanan</h2>
            <label className="field">
              <span>Nama Pelanggan</span>
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="Contoh: Rina"
                maxLength={60}
                autoComplete="off"
              />
            </label>

            <div className="field">
              <span>Tipe Pesanan</span>
              <div className="segmented" role="group" aria-label="Tipe pesanan">
                {['Dine In', 'Take Away'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={orderType === type ? 'is-active' : ''}
                    onClick={() => setOrderType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>Catatan Pesanan (opsional)</span>
              <textarea
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                rows={2}
                maxLength={280}
                placeholder="Contoh: tanpa saus, pedas sedang"
              />
            </label>

            <div className="row-actions">
              <button className="btn btn-outline" onClick={onHome}>
                Kembali ke Beranda
              </button>
              <button className="btn btn-primary btn-lg" onClick={() => goStep(2)}>
                Lanjut Pilih Menu →
              </button>
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <>
          <div className="mobile-tabs">
            <button className={mobileTab === 'menu' ? 'is-active' : ''} onClick={() => setMobileTab('menu')}>
              Menu
            </button>
            <button className={mobileTab === 'order' ? 'is-active' : ''} onClick={() => setMobileTab('order')}>
              Pesanan ({itemCount})
            </button>
          </div>

          <div className={'pos-grid tab-' + mobileTab}>
            <section className="panel menu-panel">
              <div className="panel-head">
                <div>
                  <h2>Pilih Menu</h2>
                  <p className="hint">
                    Antrean #{padQueue(queue)} · {customer || 'Pelanggan'} · {orderType}
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>
                  ← Ubah data
                </button>
              </div>

              <input
                className="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari menu…"
              />

              <div className="cat-row" role="tablist" aria-label="Kategori menu">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={category === cat}
                    className={'cat-chip' + (category === cat ? ' is-active' : '')}
                    onClick={() => setCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="menu-grid">
                {filtered.length === 0 && <div className="empty">Menu tidak ditemukan.</div>}
                {filtered.map((product) => {
                  const label = discountText(product);
                  const net = unitNet(product);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      className={'menu-card' + (!product.available ? ' is-soldout' : '')}
                      onClick={() => openItem(product)}
                      disabled={!product.available}
                    >
                      <div className="menu-card-top">
                        <span className="menu-cat">{categoryOf(product)}</span>
                        <h3>{product.name}</h3>
                        {!product.available ? (
                          <span className="tag tag-muted">Habis</span>
                        ) : label ? (
                          <span className="tag">{label}</span>
                        ) : null}
                      </div>
                      <div className="menu-card-bottom">
                        <span className="price-block">
                          {product.discount_value > 0 && <span className="price-old">{rupiah(product.price)}</span>}
                          <span className="price">{rupiah(net)}</span>
                        </span>
                        <span className="add-hint">{product.available ? '+ Tambah' : 'Terkunci'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="pos-side">
              <section className="panel cart-panel">
                <div className="panel-head">
                  <h2>Pesanan</h2>
                  <span className="hint">{itemCount} item</span>
                </div>
                {cartLines.length === 0 ? (
                  <div className="empty">Belum ada menu dipilih.</div>
                ) : (
                  <ul className="cart-list">
                    {cartLines.map((line) => (
                      <li key={line.key} className="cart-line">
                        <div className="cart-line-main">
                          <strong>{line.product.name}</strong>
                          {line.note && <span className="line-note">Catatan: {line.note}</span>}
                          <span className="hint">
                            {rupiah(line.net)} × {line.qty}
                            {line.discountPerUnit > 0 && ` · hemat ${rupiah(line.discountPerUnit * line.qty)}`}
                          </span>
                        </div>
                        <div className="cart-line-side">
                          <div className="qty-control">
                            <button type="button" onClick={() => changeQty(line.key, -1)} aria-label="Kurangi">
                              −
                            </button>
                            <span>{line.qty}</span>
                            <button type="button" onClick={() => changeQty(line.key, 1)} aria-label="Tambah">
                              +
                            </button>
                          </div>
                          <span className="cart-line-total">{rupiah(line.subtotal)}</span>
                          <button type="button" className="link-danger" onClick={() => removeItem(line.key)}>
                            Hapus
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="totals">
                  <div>
                    <span>Subtotal</span>
                    <span>{rupiah(subtotal)}</span>
                  </div>
                  <div>
                    <span>Total diskon</span>
                    <span>{discountTotal > 0 ? '-' + rupiah(discountTotal) : rupiah(0)}</span>
                  </div>
                  <div className="grand">
                    <span>Total</span>
                    <span>{rupiah(total)}</span>
                  </div>
                </div>
              </section>
            </aside>
          </div>

          <div className="flowbar">
            <div className="flowbar-info">
              <span>{itemCount} item · {customer || 'Pelanggan'}</span>
              <strong>{rupiah(total)}</strong>
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => goStep(3)} disabled={!cartLines.length}>
              Lanjut ke Rekap →
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <div className="checkout-grid">
          <section className="panel recap-panel">
            <div className="panel-head">
              <div>
                <h2>Rekap Pesanan</h2>
                <p className="hint">
                  Antrean #{padQueue(queue)} · {customer} · {orderType}
                  {orderNote ? ` · ${orderNote}` : ''}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => goStep(2)}>
                ← Ubah Menu
              </button>
            </div>

            {cartLines.length === 0 ? (
              <div className="empty">Pesanan masih kosong.</div>
            ) : (
              <ul className="recap-list">
                {cartLines.map((line) => (
                  <li key={line.key} className="recap-line">
                    <div className="recap-main">
                      <strong>{line.product.name}</strong>
                      {line.note && <span className="line-note">Catatan: {line.note}</span>}
                      <span className="hint">
                        {rupiah(line.net)} × {line.qty}
                        {line.discountPerUnit > 0 && ` · hemat ${rupiah(line.discountPerUnit * line.qty)}`}
                      </span>
                    </div>
                    <div className="cart-line-side">
                      <div className="qty-control">
                        <button type="button" onClick={() => changeQty(line.key, -1)} aria-label="Kurangi">
                          −
                        </button>
                        <span>{line.qty}</span>
                        <button type="button" onClick={() => changeQty(line.key, 1)} aria-label="Tambah">
                          +
                        </button>
                      </div>
                      <strong className="recap-subtotal">{rupiah(line.subtotal)}</strong>
                      <button type="button" className="link-danger" onClick={() => removeItem(line.key)}>
                        Hapus
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="totals">
              <div>
                <span>Subtotal</span>
                <span>{rupiah(subtotal)}</span>
              </div>
              <div>
                <span>Total diskon</span>
                <span>{discountTotal > 0 ? '-' + rupiah(discountTotal) : rupiah(0)}</span>
              </div>
              <div className="grand">
                <span>Total</span>
                <span>{rupiah(total)}</span>
              </div>
            </div>
          </section>

          <aside className="checkout-side">
            <section className="panel pay-method-panel">
              <h2>Metode Pembayaran</h2>
              <div className="segmented">
                {['Tunai', 'QRIS'].map((m) => (
                  <button key={m} type="button" className={method === m ? 'is-active' : ''} onClick={() => setMethod(m)}>
                    {m}
                  </button>
                ))}
              </div>
              <p className="hint">
                {method === 'Tunai'
                  ? 'Bayar tunai di kasir, kembalian dihitung otomatis di langkah berikutnya.'
                  : 'Tunjukkan QRIS ke pelanggan, lalu konfirmasi setelah pembayaran berhasil.'}
              </p>
              <div className="checkout-total">
                <span>Total tagihan</span>
                <strong>{rupiah(total)}</strong>
              </div>
              <button
                className="btn btn-primary btn-lg btn-block"
                onClick={() => goStep(4)}
                disabled={!cartLines.length}
              >
                Lanjut ke Pembayaran →
              </button>
              <button className="btn btn-outline btn-block" onClick={() => goStep(2)}>
                ← Kembali ke Menu
              </button>
            </section>
          </aside>
        </div>
      )}

      {step === 4 && txn && (
        <div className="step-body">
          <div className="pay-success">
            <div className="check">✓</div>
            <div>
              <h2>Pembayaran berhasil</h2>
              <p>
                Antrean <strong>#{padQueue(txn.queue_no)}</strong> · {txn.customer} · {txn.method} ·{' '}
                {rupiah(txn.total)}
              </p>
              <p className="hint">Struk 58mm siap dicetak lewat Bluetooth atau dialog browser.</p>
            </div>
          </div>
          <div className="success-actions">
            <button className="btn btn-primary btn-lg" onClick={() => setReceiptOpen(true)}>
              Lihat Preview Struk
            </button>
            <button className="btn btn-outline" onClick={printViaDialog}>
              Cetak Browser / PDF
            </button>
            <button className="btn btn-dark" onClick={startNew}>
              Transaksi Baru
            </button>
            <button className="btn btn-ghost" onClick={onHome}>
              Beranda
            </button>
          </div>
        </div>
      )}

      {step === 4 && !txn && (
        <div className="pay-grid">
          <section className="panel pay-main">
            <div className="panel-head">
              <div>
                <h2>Pembayaran {method}</h2>
                <p className="hint">
                  Antrean #{padQueue(queue)} · {customer} · {orderType}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => goStep(3)}>
                ← Ubah
              </button>
            </div>

            <div className="pay-total">
              <span>Total tagihan</span>
              <strong>{rupiah(total)}</strong>
            </div>

            {method === 'Tunai' ? (
              <>
                <label className="field">
                  <span>Uang diterima</span>
                  <input
                    inputMode="numeric"
                    value={formatThousands(paidDigits)}
                    onChange={(e) => setPaidDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="0"
                  />
                </label>
                <div className="quick-amounts">
                  <button type="button" className="chip-btn" onClick={() => setPaidDigits(String(total))}>
                    Uang Pas
                  </button>
                  {quickCash.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="chip-btn"
                      onClick={() => setPaidDigits(String(amount))}
                    >
                      {amount.toLocaleString('id-ID')}
                    </button>
                  ))}
                  <button type="button" className="chip-btn chip-reset" onClick={() => setPaidDigits('')}>
                    Reset
                  </button>
                </div>
                <div className={'change-box' + (notEnough ? ' is-warn' : '')}>
                  <span>{notEnough ? 'Kurang bayar' : 'Kembalian'}</span>
                  <strong>{rupiah(notEnough ? total - paidValue : change)}</strong>
                </div>
              </>
            ) : (
              <div className="qris-panel">
                <span className="eyebrow">Nominal QRIS</span>
                <strong className="qris-amount">{rupiah(total)}</strong>
                {qrisImage ? (
                  <img className="qris-img" src={qrisImage} alt="Kode QRIS pembayaran" />
                ) : (
                  <div className="qris-placeholder">
                    <span>QRIS</span>
                    <p>Gambar QRIS belum diatur.</p>
                    <small>Unggah gambar QRIS di Admin → Teks Web &amp; Warna.</small>
                  </div>
                )}
                <p className="hint">Scan QRIS, pastikan nominal sesuai, lalu konfirmasi pembayaran.</p>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={submitPayment}
              disabled={busy || !cartLines.length || notEnough}
            >
              {busy ? 'Memproses…' : method === 'QRIS' ? 'Konfirmasi QRIS & Selesai' : 'Proses Pembayaran'}
            </button>
            <button className="btn btn-outline btn-block" onClick={() => goStep(3)}>
              ← Kembali ke Rekap
            </button>
          </section>

          <aside className="panel pay-summary">
            <h2>Ringkasan Pesanan</h2>
            <ul className="summary-lines">
              {cartLines.map((line) => (
                <li key={line.key}>
                  <span>
                    {line.product.name} <small>× {line.qty}</small>
                  </span>
                  <strong>{rupiah(line.subtotal)}</strong>
                </li>
              ))}
            </ul>
            <div className="totals">
              <div>
                <span>Subtotal</span>
                <span>{rupiah(subtotal)}</span>
              </div>
              <div>
                <span>Total diskon</span>
                <span>{discountTotal > 0 ? '-' + rupiah(discountTotal) : rupiah(0)}</span>
              </div>
              <div className="grand">
                <span>Total</span>
                <span>{rupiah(total)}</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {itemDraft && (
        <div className="modal-backdrop" onClick={() => setItemDraft(null)}>
          <div className="modal item-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{itemDraft.product.name}</h3>
                <p className="hint">
                  {categoryOf(itemDraft.product)} · {rupiah(unitNet(itemDraft.product))}
                  {itemDraft.product.discount_value > 0 && ` · ${discountText(itemDraft.product)}`}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setItemDraft(null)} aria-label="Tutup">
                ×
              </button>
            </div>

            <div className="qty-picker">
              <button
                type="button"
                onClick={() => setItemDraft({ ...itemDraft, qty: Math.max(1, itemDraft.qty - 1) })}
                aria-label="Kurangi jumlah"
              >
                −
              </button>
              <strong>{itemDraft.qty}</strong>
              <button
                type="button"
                onClick={() => setItemDraft({ ...itemDraft, qty: Math.min(99, itemDraft.qty + 1) })}
                aria-label="Tambah jumlah"
              >
                +
              </button>
            </div>

            <label className="field modal-field">
              <span>Catatan item (opsional)</span>
              <textarea
                rows={2}
                maxLength={120}
                value={itemDraft.note}
                onChange={(e) => setItemDraft({ ...itemDraft, note: e.target.value })}
                placeholder="Contoh: tanpa bumbu kacang"
              />
            </label>

            <div className="item-total">
              <span>Subtotal</span>
              <strong>{rupiah(unitNet(itemDraft.product) * itemDraft.qty)}</strong>
            </div>

            <button className="btn btn-primary btn-block btn-lg" onClick={commitItem}>
              Tambahkan ke Pesanan
            </button>
          </div>
        </div>
      )}

      {receiptOpen && txn && (
        <div className="modal-backdrop" onClick={() => setReceiptOpen(false)}>
          <div className="modal receipt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>Preview Struk 58mm</h3>
                <p className="hint">
                  Antrean #{padQueue(txn.queue_no)} · {txn.customer} · {txn.method}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setReceiptOpen(false)} aria-label="Tutup">
                ×
              </button>
            </div>

            <div className="receipt-success compact">
              <div className="check">✓</div>
              <p>
                Pembayaran berhasil · total <strong>{rupiah(txn.total)}</strong>
              </p>
            </div>

            {printMsg && <div className="alert alert-info">{printMsg}</div>}

            <div className="receipt-paper">
              <Receipt txn={txn} settings={settings} printArea />
            </div>

            <div className="receipt-actions">
              <button className="btn btn-primary" onClick={handleBluetoothPrint}>
                Cetak Bluetooth 58mm
              </button>
              <button className="btn btn-outline" onClick={printViaDialog}>
                Cetak Browser / PDF
              </button>
              <button className="btn btn-outline" onClick={testPrint}>
                Uji Cetak
              </button>
              <button className="btn btn-dark" onClick={startNew}>
                Transaksi Baru
              </button>
            </div>
            <p className="hint small-note center">
              Struk 100% monokrom · status printer:{' '}
              {printer.connected ? `terhubung (${printer.name})` : 'belum terhubung'} · 2 rangkap (pelanggan +
              salinan dapur) · nama menu panjang turun baris otomatis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
