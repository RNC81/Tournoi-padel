import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

// Navbar sticky avec effet glassmorphism — présente sur toutes les pages publiques
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-dark-900/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* Logo / nom du tournoi */}
        <Link to="/" className="flex items-center gap-3 group">
          {/* Icône raquette de padel en SVG inline */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-primary-400 group-hover:text-primary-300 transition-colors">
            <ellipse cx="13" cy="11" rx="9" ry="11" stroke="currentColor" strokeWidth="2" fill="none"/>
            <line x1="13" y1="22" x2="13" y2="27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="8" y1="27" x2="18" y2="27" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="8" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
            <line x1="6" y1="11" x2="20" y2="11" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
            <line x1="7" y1="14" x2="19" y2="14" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
          </svg>
          <div>
            <span className="font-display font-black text-white text-lg tracking-tight leading-none block">
              PYC PADEL
            </span>
            <span className="text-white/30 text-[10px] uppercase tracking-widest leading-none">
              Paris Yaar Club
            </span>
          </div>
        </Link>

        {/* Bouton Connexion / Menu utilisateur */}
        <div className="relative" ref={menuRef}>
          {user ? (
            /* Utilisateur connecté : afficher son nom + menu */
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-primary-400" />
              <span className="text-sm text-white font-medium">{user.username}</span>
              <svg className={`w-3 h-3 text-white/40 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            /* Visiteur : bouton Connexion */
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all active:scale-95"
            >
              Connexion
              <svg className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {/* Menu déroulant */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-dark-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
              {user ? (
                /* Options admin connecté */
                <>
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Connecté</p>
                    <p className="text-sm font-semibold text-white mt-0.5">{user.username}</p>
                    {user.role === 'super_admin' && (
                      <span className="text-[10px] font-bold text-gold-400 uppercase tracking-wider">Super Admin</span>
                    )}
                  </div>
                  <Link
                    to="/tournoi"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <span className="text-base">👁️</span> Vue joueur
                  </Link>
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <span className="text-base">⚙️</span> Dashboard admin
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors border-t border-white/10"
                  >
                    <span className="text-base">🚪</span> Déconnexion
                  </button>
                </>
              ) : (
                /* Options visiteur */
                <>
                  <Link
                    to="/tournoi"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400 group-hover:bg-primary-500/30 transition-colors">
                      🎾
                    </div>
                    <div>
                      <div className="font-medium">Vue joueur</div>
                      <div className="text-white/40 text-xs">Suivre le tournoi</div>
                    </div>
                  </Link>
                  <Link
                    to="/admin/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors group border-t border-white/10"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gold-500/20 flex items-center justify-center text-gold-400 group-hover:bg-gold-500/30 transition-colors">
                      🔑
                    </div>
                    <div>
                      <div className="font-medium">Administration</div>
                      <div className="text-white/40 text-xs">Espace organisateurs</div>
                    </div>
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
