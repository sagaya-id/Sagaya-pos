import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { rupiah } from '../util.js';
import Receipt from '../components/Receipt.jsx';
import { sampleTransaction } from '../receipt.js';
import { connectPrinter, disconnectPrinter, printerStatus, onPrinterChange, printRows, testPrintRows, isBluetoothSupported } from '../printer.js';
import { buildReceipt } from '../receipt.js';
import Recap from './Recap.jsx';

const TABS = [
  { id: 'katalog', label: 'Menu & Katalog' },
  { id: 'tampilan', label: 'Teks Web & Warna' },
  { id: 'struk', label: 'Teks Struk' },
  { id: 'koneksi', label: 'Printer & Keamanan' },
  { id: 'rekap', label: 'Rekap Pesanan' },
];

const COLOR_FIELDS = [
  ['primary', 'Warna utama'],
  ['primaryDark', 'Warna utama gelap'],
  ['accent', 'Warna aksen'],
  ['bg', 'Latar halaman'],
  ['surface', 'Latar kartu'],
  ['text', 'Warna teks'],
  ['muted', 'Teks sekunder'],
  ['headerText', 'Teks header'],
  ['border', 'Garis batas'],
  ['success', 'Status tersedia'],
  ['danger', 'Status batal / habis'],
  ['dangerSoft', 'Latar status batal'],
];

export default function Admin({ settings, refresh, onExit, onHome }) {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState('katalog');

  useEffect(() => {
    api
      .session()
      .then((r) => setAuthed(Boolean(r.authed)))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <div className="spinner" />
          <p>Memeriksa sesi admin…</p>
        </div>
      </div>
    );
  }

  if (!authed) {
    return <LoginScreen settings={settings} onHome={onHome} onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="app-shell admin-shell">
      <header className="posbar">
        <div className="brand">
          <span className="brand-mark">BS</span>
          <div className="brand-text">
            <strong>Admin · {settings.texts.storeName}</strong>
            <span>Kelola katalog, tampilan, struk, dan rekap</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={onExit}>
            Ke Kasir
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={async () => {
              await api.logout().catch(() => {});
              setAuthed(false);
            }}
          >
            Keluar
          </button>
        </div>
      </header>

      <nav className="admin-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'katalog' && <CatalogTab />}
      {tab === 'tampilan' && <AppearanceTab settings={settings} onSaved={refresh} />}
      {tab === 'struk' && <ReceiptTab settings={settings} onSaved={refresh} />}
      {tab === 'koneksi' && <ConnectionTab settings={settings} />}
      {tab === 'rekap' && <Recap settings={settings} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LoginScreen({ settings, onSuccess, onHome }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <span className="brand-mark brand-mark-lg">BS</span>
        <h1>Masuk Admin</h1>
        <p className="hint">
          Panel admin {settings.texts.storeName} untuk katalog, tampilan, struk, printer, dan rekap penjualan.
        </p>
        <label className="field">
          <span>Sandi Admin</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Masukkan sandi"
            autoFocus
            autoComplete="current-password"
          />
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Memeriksa…' : 'Masuk'}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onHome}>
          ← Kembali ke Beranda
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const emptyProduct = {
  id: null,
  name: '',
  category: 'Makanan',
  price: '',
  discount_type: 'rp',
  discount_value: '',
  available: true,
  active: true,
};

function CatalogTab() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyProduct);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.adminProducts();
      setProducts(data.products);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startAdd = () => {
    setForm(emptyProduct);
    setShowForm(true);
    setNotice('');
  };

  const startEdit = (p) => {
    setForm({
      id: p.id,
      name: p.name,
      category: p.category || 'Makanan',
      price: String(p.price),
      discount_type: p.discount_type,
      discount_value: String(p.discount_value || ''),
      available: Boolean(p.available),
      active: Boolean(p.active),
    });
    setShowForm(true);
    setNotice('');
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      name: form.name,
      category: form.category,
      price: Number(form.price) || 0,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      available: form.available,
      active: form.active,
    };
    try {
      if (form.id) await api.updateProduct(form.id, payload);
      else await api.createProduct(payload);
      setShowForm(false);
      setNotice(form.id ? 'Menu diperbarui.' : 'Menu baru ditambahkan.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggle = async (product, field) => {
    setError('');
    try {
      await api.updateProduct(product.id, {
        name: product.name,
        category: product.category || 'Makanan',
        price: product.price,
        discount_type: product.discount_type,
        discount_value: product.discount_value,
        available: field === 'available' ? !product.available : Boolean(product.available),
        active: field === 'active' ? !product.active : Boolean(product.active),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (product) => {
    if (!window.confirm(`Hapus menu "${product.name}"? Riwayat transaksi lama tetap tersimpan.`)) return;
    try {
      await api.deleteProduct(product.id);
      setNotice('Menu dihapus.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="admin-panel">
      <div className="panel-head">
        <div>
          <h2>Manajemen Menu & Katalog</h2>
          <p className="hint">Harga normal, diskon Rupiah/Persen, serta status Tersedia/Habis.</p>
        </div>
        <button className="btn btn-primary" onClick={startAdd}>
          + Tambah Menu
        </button>
      </div>

      {notice && <div className="alert alert-info">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <form className="product-form" onSubmit={save}>
          <div className="form-grid">
            <label className="field span-2">
              <span>Nama Menu</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Batagor Keju Mozzarella"
                required
              />
            </label>
            <label className="field">
              <span>Kategori</span>
              <input
                list="product-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Makanan"
                maxLength={40}
                required
              />
            </label>
            <datalist id="product-categories">
              {[...new Set(['Makanan', 'Minuman', 'Frozen', ...products.map((p) => p.category).filter(Boolean)])].map(
                (cat) => (
                  <option key={cat} value={cat} />
                )
              )}
            </datalist>
            <label className="field">
              <span>Harga Normal (Rp)</span>
              <input
                inputMode="numeric"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                placeholder="18000"
                required
              />
            </label>
            <label className="field">
              <span>Tipe Diskon</span>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
              >
                <option value="rp">Rupiah (Rp)</option>
                <option value="pct">Persen (%)</option>
              </select>
            </label>
            <label className="field">
              <span>Nilai Diskon {form.discount_type === 'pct' ? '(%)' : '(Rp)'}</span>
              <input
                inputMode="numeric"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                placeholder="0"
              />
            </label>
            <label className="switch-field">
              <input
                type="checkbox"
                checked={form.available}
                onChange={(e) => setForm({ ...form, available: e.target.checked })}
              />
              <span>Tersedia (uncheck = Habis)</span>
            </label>
            <label className="switch-field">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <span>Tampil di katalog</span>
            </label>
          </div>
          <div className="row-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Batal
            </button>
            <button className="btn btn-primary">{form.id ? 'Simpan Perubahan' : 'Simpan Menu'}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="empty">Memuat katalog…</div>
      ) : products.length === 0 ? (
        <div className="empty">Belum ada menu. Tambahkan menu pertama.</div>
      ) : (
        <div className="product-list">
          {products.map((p) => (
            <div key={p.id} className={'product-row' + (!p.active ? ' is-inactive' : '')}>
              <div className="product-main">
                <strong>{p.name}</strong>
                <div className="product-tags">
                  <span className="tag tag-neutral">{p.category || 'Makanan'}</span>
                  <span className="tag tag-neutral">{rupiah(p.price)}</span>
                  {p.discount_value > 0 && (
                    <span className="tag">
                      {p.discount_type === 'pct' ? `Diskon ${p.discount_value}%` : `Hemat ${rupiah(p.discount_value)}`}
                    </span>
                  )}
                  {!p.active && <span className="tag tag-muted">Nonaktif</span>}
                </div>
              </div>
              <div className="product-actions">
                <button
                  className={'pill-toggle' + (p.available ? ' is-on' : '')}
                  onClick={() => toggle(p, 'available')}
                >
                  {p.available ? 'Tersedia' : 'Habis'}
                </button>
                <button className={'pill-toggle' + (p.active ? ' is-on' : '')} onClick={() => toggle(p, 'active')}>
                  {p.active ? 'Aktif' : 'Nonaktif'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>
                  Edit
                </button>
                <button className="btn btn-danger-ghost btn-sm" onClick={() => remove(p)}>
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function AppearanceTab({ settings, onSaved }) {
  const [texts, setTexts] = useState(settings.texts);
  const [theme, setTheme] = useState(settings.theme);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const onQrisFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Berkas QRIS harus berupa gambar (PNG/JPG/WebP).');
      e.target.value = '';
      return;
    }
    if (file.size > 450 * 1024) {
      setError('Ukuran gambar QRIS maksimal 450 KB. Kompres dulu gambarnya.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setTexts((prev) => ({ ...prev, qrisImage: String(reader.result || '') }));
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.saveSettings({ texts, theme });
      await onSaved();
      setNotice('Teks web dan warna berhasil disimpan.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const textFields = [
    ['storeName', 'Nama Toko'],
    ['navSubheader', 'Sub-header Navbar'],
    ['heroBadge', 'Badge Landing Page'],
    ['landingTitle', 'Judul Landing Page'],
    ['landingCta', 'Teks Tombol Utama'],
    ['infoAddress', 'Alamat Toko'],
    ['infoPhone', 'Telepon / WhatsApp'],
    ['infoHours', 'Jam Buka'],
    ['footerText', 'Teks Footer'],
  ];

  return (
    <form className="admin-panel" onSubmit={save}>
      <div className="panel-head">
        <div>
          <h2>Teks Web, Warna & Landing Page</h2>
          <p className="hint">Semua perangkat memakai pengaturan yang sama dari database.</p>
        </div>
      </div>

      {notice && <div className="alert alert-info">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-grid">
        {textFields.map(([key, label]) => (
          <label className={'field' + (key === 'landingTitle' ? ' span-2' : '')} key={key}>
            <span>{label}</span>
            <input value={texts[key] || ''} onChange={(e) => setTexts({ ...texts, [key]: e.target.value })} />
          </label>
        ))}
        <label className="field span-2">
          <span>Deskripsi Landing Page</span>
          <textarea
            rows={3}
            value={texts.landingDesc || ''}
            onChange={(e) => setTexts({ ...texts, landingDesc: e.target.value })}
          />
        </label>
        <div className="field span-2">
          <span>Gambar QRIS Pembayaran</span>
          <input
            className="file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onQrisFile}
          />
          <input
            value={(texts.qrisImage || '').startsWith('data:') ? '' : texts.qrisImage || ''}
            onChange={(e) => setTexts({ ...texts, qrisImage: e.target.value })}
            placeholder="atau tempel URL gambar QRIS: https://…"
          />
          <small className="hint">
            Unggah foto QRIS (maks. 450 KB) atau tempel URL. Gambar tampil di langkah pembayaran QRIS.
          </small>
          {texts.qrisImage && (
            <div className="qris-admin-preview-wrap">
              <img className="qris-admin-preview" src={texts.qrisImage} alt="Pratinjau gambar QRIS" />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setTexts({ ...texts, qrisImage: '' })}
              >
                Hapus gambar
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 className="sub-title">Kustomisasi Warna Manual</h3>
      <div className="color-grid">
        {COLOR_FIELDS.map(([key, label]) => (
          <div className="color-field" key={key}>
            <span>{label}</span>
            <div className="color-inputs">
              <input
                type="color"
                value={theme[key] || '#000000'}
                onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                aria-label={label}
              />
              <input
                className="hex-input"
                value={theme[key] || ''}
                onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                placeholder="#RRGGBB"
                maxLength={7}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="preview-banner" style={{ background: theme.primary, color: theme.headerText }}>
        <strong>{texts.storeName}</strong>
        <span>{texts.navSubheader}</span>
        <span
          className="preview-chip"
          style={{ background: theme.accent, color: theme.text }}
        >
          {texts.landingCta}
        </span>
      </div>

      <div className="row-actions">
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan Pengaturan'}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function ReceiptTab({ settings, onSaved }) {
  const [receipt, setReceipt] = useState(settings.receipt);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.saveSettings({ receipt });
      await onSaved();
      setNotice('Teks struk tersimpan.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const previewSettings = { ...settings, receipt };

  return (
    <form className="admin-panel" onSubmit={save}>
      <div className="panel-head">
        <div>
          <h2>Kustomisasi Teks Struk Thermal 58mm</h2>
          <p className="hint">Header dan footer dipakai di preview maupun hasil cetak Bluetooth.</p>
        </div>
      </div>

      {notice && <div className="alert alert-info">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="receipt-editor">
        <div className="form-grid">
          <label className="field span-2">
            <span>Header Atas 1</span>
            <input value={receipt.header1 || ''} onChange={(e) => setReceipt({ ...receipt, header1: e.target.value })} />
          </label>
          <label className="field span-2">
            <span>Header Atas 2 / Sub-Header</span>
            <textarea
              rows={2}
              value={receipt.header2 || ''}
              onChange={(e) => setReceipt({ ...receipt, header2: e.target.value })}
            />
            <small className="hint">Boleh beberapa baris (Enter untuk baris baru).</small>
          </label>
          <label className="field span-2">
            <span>Footer Bawah 1</span>
            <textarea
              rows={2}
              value={receipt.footer1 || ''}
              onChange={(e) => setReceipt({ ...receipt, footer1: e.target.value })}
            />
          </label>
          <label className="field span-2">
            <span>Footer Bawah 2</span>
            <textarea
              rows={2}
              value={receipt.footer2 || ''}
              onChange={(e) => setReceipt({ ...receipt, footer2: e.target.value })}
            />
          </label>
        </div>
        <div className="receipt-preview">
          <div className="receipt-paper">
            <Receipt txn={sampleTransaction(previewSettings)} settings={previewSettings} />
          </div>
          <p className="hint center">Preview skala 58mm</p>
        </div>
      </div>

      <div className="row-actions">
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan Teks Struk'}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function ConnectionTab({ settings }) {
  const [printer, setPrinter] = useState(printerStatus());
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [queueMsg, setQueueMsg] = useState('');
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');

  useEffect(() => onPrinterChange(setPrinter), []);

  const connect = async () => {
    setMsg('');
    setError('');
    try {
      await connectPrinter();
      setMsg('Printer berhasil terhubung.');
    } catch (err) {
      setError(err.message);
    }
  };

  const testPrint = async () => {
    setMsg('');
    setError('');
    try {
      if (!printer.connected) await connectPrinter();
      await printRows(testPrintRows());
      setMsg('Uji cetak dikirim ke printer.');
    } catch (err) {
      setError(err.message);
    }
  };

  const printSample = async () => {
    setMsg('');
    setError('');
    try {
      if (!printer.connected) await connectPrinter();
      const { rows } = buildReceipt(sampleTransaction(settings), settings);
      await printRows(rows);
      setMsg('Struk contoh tercetak.');
    } catch (err) {
      setError(err.message);
    }
  };

  const resetQueue = async () => {
    if (!window.confirm('Reset nomor antrean hari ini ke #001?')) return;
    try {
      const res = await api.resetQueue();
      setQueueMsg(`Nomor antrean direset. Antrean berikutnya #${String(res.number).padStart(3, '0')}.`);
    } catch (err) {
      setQueueMsg(err.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdError('');
    if (pwd.next !== pwd.confirm) return setPwdError('Konfirmasi sandi baru tidak sama.');
    if (pwd.next.length < 6) return setPwdError('Sandi baru minimal 6 karakter.');
    try {
      await api.changePassword(pwd.current, pwd.next);
      setPwd({ current: '', next: '', confirm: '' });
      setPwdMsg('Sandi admin berhasil diubah. Silakan login ulang.');
    } catch (err) {
      setPwdError(err.message);
    }
  };

  return (
    <div className="admin-panel">
      <div className="panel-head">
        <div>
          <h2>Koneksi, Print Bluetooth & Keamanan</h2>
          <p className="hint">Printer thermal 58mm via Web Bluetooth (ESC/POS).</p>
        </div>
      </div>

      {msg && <div className="alert alert-info">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="split-2">
        <section className="sub-card">
          <h3>Printer Bluetooth</h3>
          <div className={'status-line' + (printer.connected ? ' is-on' : '')}>
            <span className="dot" />
            {printer.connected ? `Terhubung: ${printer.name}` : 'Belum terhubung'}
          </div>
          {!isBluetoothSupported() && (
            <p className="hint">
              Browser ini belum mendukung Web Bluetooth. Gunakan Chrome/Edge di Android atau desktop, atau cetak lewat
              dialog.
            </p>
          )}
          <div className="row-actions">
            {printer.connected ? (
              <button className="btn btn-outline" onClick={() => disconnectPrinter()}>
                Putuskan
              </button>
            ) : (
              <button className="btn btn-primary" onClick={connect}>
                Hubungkan Printer
              </button>
            )}
            <button className="btn btn-outline" onClick={testPrint}>
              Uji Cetak / Test Print
            </button>
            <button className="btn btn-outline" onClick={printSample}>
              Cetak Struk Contoh
            </button>
          </div>
        </section>

        <section className="sub-card">
          <h3>Nomor Antrean</h3>
          <p className="hint">
            Nomor antrean bertambah otomatis dan reset sendiri setiap ganti hari (WIB). Reset manual di sini akan
            memulai kembali dari #001 untuk hari ini.
          </p>
          <button className="btn btn-outline" onClick={resetQueue}>
            Reset Nomor Antrean
          </button>
          {queueMsg && <p className="status-text">{queueMsg}</p>}
        </section>
      </div>

      <form className="sub-card" onSubmit={changePassword}>
        <h3>Ubah Sandi Admin</h3>
        <p className="hint">Sandi disimpan terenkripsi (hash) di database, bukan di browser.</p>
        {pwdMsg && <div className="alert alert-info">{pwdMsg}</div>}
        {pwdError && <div className="alert alert-error">{pwdError}</div>}
        <div className="form-grid">
          <label className="field">
            <span>Sandi Lama</span>
            <input type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
          </label>
          <label className="field">
            <span>Sandi Baru</span>
            <input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
          </label>
          <label className="field">
            <span>Ulangi Sandi Baru</span>
            <input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
          </label>
        </div>
        <div className="row-actions">
          <button className="btn btn-primary">Simpan Sandi Baru</button>
        </div>
      </form>
    </div>
  );
}
