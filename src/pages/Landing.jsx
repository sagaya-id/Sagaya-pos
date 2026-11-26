import { rupiah, padQueue, formatDateLong } from '../util.js';

function discountLabel(product) {
  if (!product.discount_value) return null;
  if (product.discount_type === 'pct') return `Diskon ${product.discount_value}%`;
  return `Hemat ${rupiah(product.discount_value)}`;
}

export default function Landing({ settings, products, queue, onStart, onAdmin }) {
  const { texts } = settings;
  const menu = products.filter((p) => p.available).slice(0, 8);

  return (
    <div className="landing">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">BS</span>
          <div className="brand-text">
            <strong>{texts.storeName}</strong>
            <span>{texts.navSubheader}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={onAdmin}>
            Admin
          </button>
          <button className="btn btn-primary btn-sm" onClick={onStart}>
            Kasir
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="badge">{texts.heroBadge}</span>
            <h1>{texts.landingTitle}</h1>
            <p>{texts.landingDesc}</p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={onStart}>
                {texts.landingCta || 'Mulai Pesan'}
              </button>
              <div className="queue-chip">
                <span>Antrean berikutnya</span>
                <strong>#{padQueue(queue)}</strong>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <h2>Info Toko</h2>
            <ul className="info-list">
              <li>
                <span className="info-icon">📍</span>
                <div>
                  <small>Alamat</small>
                  <p>{texts.infoAddress}</p>
                </div>
              </li>
              <li>
                <span className="info-icon">📞</span>
                <div>
                  <small>Telepon / WhatsApp</small>
                  <p>{texts.infoPhone}</p>
                </div>
              </li>
              <li>
                <span className="info-icon">🕒</span>
                <div>
                  <small>Jam Buka</small>
                  <p>{texts.infoHours}</p>
                </div>
              </li>
            </ul>
            <div className="hero-card-foot">{formatDateLong(new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10))}</div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <h2>Menu Hari Ini</h2>
              <p>Harga sudah termasuk diskon promo yang sedang berjalan.</p>
            </div>
            <button className="btn btn-outline" onClick={onStart}>
              Pesan sekarang
            </button>
          </div>
          {menu.length === 0 ? (
            <div className="empty">Belum ada menu tersedia. Tambahkan dari panel Admin.</div>
          ) : (
            <div className="menu-preview-grid">
              {menu.map((p) => {
                const label = discountLabel(p);
                return (
                  <article key={p.id} className="menu-tile">
                    <div className="menu-tile-head">
                      <h3>{p.name}</h3>
                      {label && <span className="tag">{label}</span>}
                    </div>
                    <div className="menu-tile-price">{rupiah(p.price)}</div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <p>{texts.footerText}</p>
      </footer>
    </div>
  );
}
