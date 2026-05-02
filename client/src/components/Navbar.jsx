import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

// Navbar sticky sur fond beige — présente sur toutes les pages publiques.
// Thème : sports editorial clair (forest / beige / lime).
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Ferme le dropdown si clic en dehors
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-beige/90 backdrop-blur-md border-b border-forest/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          {/* Icône raquette padel */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"
            className="text-forest group-hover:text-forest-light transition-colors">
            <ellipse cx="13" cy="11" rx="9" ry="11" stroke="currentColor" strokeWidth="2" fill="none"/>
            <line x1="13" y1="22" x2="13" y2="27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="8" y1="27" x2="18" y2="27" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="8" y1="8" x2="18" y2="8" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
            <line x1="6" y1="11" x2="20" y2="11" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
            <line x1="7" y1="14" x2="19" y2="14" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
          </svg>
          <div>
            <span className="font-display font-black text-forest text-lg tracking-tight leading-none block">
              PYC PADEL
            </span>
            <span className="text-forest/40 text-[10px] uppercase tracking-widest leading-none">
              Paris Yaar Club
            </span>
          </div>
        </Link>

        {/* Liens de navigation — masqués sur mobile */}
        <nav className="hidden md:flex items-center gap-6">
          <a href="/#programme" className="text-sm font-medium text-forest/70 hover:text-forest transition-colors">
            Programme
          </a>
          <a href="/#reglement" className="text-sm font-medium text-forest/70 hover:text-forest transition-colors">
            Règlement
          </a>
          <Link to="/tournoi" className="text-sm font-medium text-forest/70 hover:text-forest transition-colors">
            Scores live
          </Link>
        </nav>

        {/* Bouton Connexion / Menu utilisateur */}
        <div className="relative" ref={menuRef}>
          {user ? (
            /* Admin connecté */
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 bg-forest/10 hover:bg-forest/15 border border-forest/20 rounded-lg px-3 py-2 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-lime" />
              <span className="text-sm text-forest font-semibold">{user.username}</span>
              <svg
                className={`w-3 h-3 text-forest/50 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            /* Visiteur */
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 bg-forest hover:bg-forest-dark text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all active:scale-95"
            >
              Connexion
              <svg
                className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-forest/10 rounded-xl shadow-xl overflow-hidden animate-fade-in">
              {user ? (
                <>
                  <div className="px-4 py-3 border-b border-forest/8 bg-forest-50">
                    <p className="text-xs text-forest/40 uppercase tracking-wider">Connecté</p>
                    <p className="text-sm font-semibold text-forest mt-0.5">{user.username}</p>
                    {user.role === 'super_admin' && (
                      <span className="text-[10px] font-bold text-lime-dark uppercase tracking-wider">Super Admin</span>
                    )}
                  </div>
                  <Link
                    to="/tournoi"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-forest/70 hover:text-forest hover:bg-forest-50 transition-colors"
                  >
                    <span className="text-base">👁️</span> Vue joueur
                  </Link>
                  <Link
                    to="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-forest/70 hover:text-forest hover:bg-forest-50 transition-colors"
                  >
                    <span className="text-base">⚙️</span> Dashboard admin
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors border-t border-forest/8"
                  >
                    <span className="text-base">🚪</span> Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/tournoi"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-forest hover:bg-forest-50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center text-forest group-hover:bg-forest/15 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold">Vue joueur</div>
                      <div className="text-forest/40 text-xs">Suivre le tournoi</div>
                    </div>
                  </Link>
                  <Link
                    to="/admin/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-forest hover:bg-forest-50 transition-colors group border-t border-forest/8"
                  >
                    <div className="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center text-forest group-hover:bg-forest/15 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold">Administration</div>
                      <div className="text-forest/40 text-xs">Espace organisateurs</div>
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
