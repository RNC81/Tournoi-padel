import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';

// URL de santé — proxy Vite en dev, backend Render en prod
const HEALTH_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/health`
  : '/api/health';

const NAV_ITEMS = [
  { path: '/admin',                    label: 'Dashboard',      exact: true  },
  { path: '/admin/tournament',         label: 'Config tournoi', exact: false },
  { path: '/admin/teams',              label: 'Équipes',        exact: false },
  { path: '/admin/groups',             label: 'Poules',         exact: false },
  { path: '/admin/bracket',            label: 'Bracket',        exact: true  },
  { path: '/admin/bracket/consolante', label: 'Consolante',     exact: false },
];

// ─── KEEP-ALIVE HOOK ──────────────────────────────────────────────────────────
// Ping /api/health toutes les 10 minutes pour empêcher le serveur Render de
// s'endormir. État persisté dans localStorage pour survivre au refresh.

function useKeepAlive() {
  const [active, setActive] = useState(
    () => localStorage.getItem('keepAlive') === 'true'
  );

  useEffect(() => {
    if (!active) return;

    // Ping immédiat au démarrage
    fetch(HEALTH_URL).catch(() => {});

    const interval = setInterval(() => {
      fetch(HEALTH_URL)
        .then(() => console.log('[keep-alive] ping ok'))
        .catch(() => {});
    }, 10 * 60 * 1000); // 10 min

    return () => clearInterval(interval);
  }, [active]);

  const toggle = () => {
    setActive(prev => {
      const next = !prev;
      localStorage.setItem('keepAlive', String(next));
      return next;
    });
  };

  return { active, toggle };
}

// ─── COMPOSANT ────────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { active: keepAlive, toggle: toggleKeepAlive } = useKeepAlive();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="flex min-h-screen bg-dark-900">
      {/* ── SIDEBAR ────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-dark-800 border-r border-white/10 flex flex-col fixed inset-y-0 left-0">

        {/* Logo */}
        <div className="px-5 pt-6 pb-4 border-b border-white/10">
          <div className="font-display font-black text-white text-lg tracking-tight">PYC Admin</div>
          <div className="text-white/30 text-xs mt-0.5 truncate">
            @{user?.username}
            {user?.role === 'super_admin' && (
              <span className="ml-1.5 text-gold-400">★ super</span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ path, label, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-500/15 text-primary-400'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Keep-alive toggle */}
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={toggleKeepAlive}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  keepAlive ? 'bg-primary-400 animate-pulse' : 'bg-white/20'
                }`}
              />
              <span className="text-xs text-white/50">
                {keepAlive ? 'Serveur actif' : 'Mode veille'}
              </span>
            </div>
            {/* Toggle pill */}
            <div
              className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 ${
                keepAlive ? 'bg-primary-500' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${
                  keepAlive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
          <p className="text-white/25 text-xs px-3 mt-1">
            {keepAlive ? 'Ping /health toutes les 10 min' : 'Le serveur peut s\'endormir'}
          </p>
        </div>

        {/* Logout */}
        <div className="px-4 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── CONTENU PRINCIPAL ──────────────────────────────────────── */}
      <main className="flex-1 ml-56 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
