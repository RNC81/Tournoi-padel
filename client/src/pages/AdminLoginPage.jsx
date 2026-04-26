import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { user, login, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect automatique si déjà connecté
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/admin', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Identifiant ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  // Attendre que l'auth soit initialisée avant d'afficher le formulaire
  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-white/30 text-sm">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="font-display font-black text-3xl text-white tracking-tight">PYC</div>
          <div className="font-display font-black text-sm text-primary-400 tracking-widest uppercase mb-1">Padel</div>
          <h1 className="font-display font-bold text-xl text-white mt-3">Administration</h1>
          <p className="text-white/30 text-sm mt-1">Paris Yaar Club</p>
        </div>

        {/* Formulaire */}
        <div className="card">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Identifiant</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input"
                placeholder="admin"
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1.5">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          Accès réservé aux organisateurs
        </p>
      </div>
    </div>
  );
}
