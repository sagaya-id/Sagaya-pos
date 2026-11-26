import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import Landing from './pages/Landing.jsx';
import Kasir from './pages/Kasir.jsx';
import Admin from './pages/Admin.jsx';

const THEME_VARS = {
  primary: '--brand',
  primaryDark: '--brand-dark',
  accent: '--accent',
  bg: '--bg',
  surface: '--surface',
  text: '--ink',
  muted: '--muted',
  headerText: '--header-ink',
  border: '--border',
  success: '--success',
  danger: '--danger',
  dangerSoft: '--danger-soft',
};

export default function App() {
  const [boot, setBoot] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('landing');

  const load = useCallback(async () => {
    try {
      const data = await api.bootstrap();
      setBoot(data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const theme = boot?.settings?.theme;

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    for (const [key, cssVar] of Object.entries(THEME_VARS)) {
      if (theme[key]) root.style.setProperty(cssVar, theme[key]);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && theme.primary) meta.setAttribute('content', theme.primary);
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [view]);

  const refresh = useCallback(async () => {
    const data = await api.bootstrap();
    setBoot(data);
    return data;
  }, []);

  const settings = boot?.settings;
  const content = useMemo(() => {
    if (!settings) return null;
    if (view === 'admin') {
      return <Admin settings={settings} refresh={refresh} onExit={() => setView('kasir')} onHome={() => setView('landing')} />;
    }
    if (view === 'kasir') {
      return (
        <Kasir
          settings={settings}
          products={boot.products || []}
          queue={boot.queue}
          refresh={refresh}
          onHome={() => setView('landing')}
          onAdmin={() => setView('admin')}
        />
      );
    }
    return (
      <Landing
        settings={settings}
        products={boot.products || []}
        queue={boot.queue}
        onStart={() => setView('kasir')}
        onAdmin={() => setView('admin')}
      />
    );
  }, [boot, settings, view, refresh]);

  if (error && !boot) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <h1>Koneksi ke database gagal</h1>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={load}>
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <div className="spinner" />
          <p>Memuat kasir Batagor Sagaya…</p>
        </div>
      </div>
    );
  }

  return content;
}
