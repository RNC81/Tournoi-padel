import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import api from '../utils/api';

// Dashboard principal admin — vue d'ensemble et actions
export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ count: 0, max: 100 });
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [countRes, tournamentRes] = await Promise.all([
        api.get('/teams/count'),
        api.get('/tournament').catch(() => ({ data: null })),
      ]);
      setStats(countRes.data);
      setTournament(tournamentRes.data);
    } catch (err) {}
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const initTournament = async () => {
    setLoading(true);
    try {
      await api.post('/tournament/init', { name: 'Tournoi Paris Yaar Club' });
      setMessage('Tournoi initialisé avec succès !');
      fetchData();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const generateGroups = async () => {
    if (!confirm(`Générer les poules pour ${stats.count} équipes ? Cette action ne peut pas être annulée.`)) return;
    setLoading(true);
    try {
      const res = await api.post('/tournament/generate-groups');
      setMessage(res.data.message);
      fetchData();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const generateBracket = async () => {
    if (!confirm('Clôturer les poules et générer les brackets ? Tous les scores de poule doivent être saisis.')) return;
    setLoading(true);
    try {
      const res = await api.post('/tournament/generate-bracket');
      setMessage(`${res.data.message} — ${res.data.qualified} qualifiés, ${res.data.consolation} en consolante`);
      fetchData();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = {
    registration: 'Inscriptions ouvertes',
    group_stage:  'Phase de poules',
    knockout:     'Phase finale',
    finished:     'Tournoi terminé',
  };

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="bg-dark-800 border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-xl text-white">Admin — Paris Yaar Club</h1>
            <p className="text-white/40 text-xs mt-0.5">
              Connecté en tant que <span className="text-primary-400">{user?.username}</span>
              {user?.role === 'super_admin' && <span className="ml-2 badge bg-gold-500 text-dark-900">Super Admin</span>}
            </p>
          </div>
          <button onClick={handleLogout} className="text-white/40 hover:text-white text-sm transition-colors">
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Message feedback */}
        {message && (
          <div className="bg-primary-500/10 border border-primary-500/30 text-primary-400 rounded-lg px-4 py-3 mb-6 text-sm flex justify-between">
            {message}
            <button onClick={() => setMessage('')} className="text-white/40 hover:text-white ml-4">✕</button>
          </div>
        )}

        {/* Statut du tournoi */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Équipes inscrites" value={`${stats.count} / ${stats.max}`} />
          <StatCard label="Statut" value={tournament ? statusLabel[tournament.status] : '—'} />
          <StatCard label="Groupes" value={tournament?.groups?.length || 0} />
          <StatCard label="Matchs bracket" value={tournament?.knockoutMatches?.length || 0} />
        </div>

        {/* Actions selon la phase */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Initialiser le tournoi */}
          {!tournament && user?.role === 'super_admin' && (
            <ActionCard
              title="Initialiser le tournoi"
              desc="Crée le document tournoi en base de données et ouvre les inscriptions."
              action={initTournament}
              loading={loading}
              label="Initialiser"
            />
          )}

          {/* Générer les poules */}
          {tournament?.status === 'registration' && (
            <ActionCard
              title="Générer les poules"
              desc={`Tirage au sort aléatoire des ${stats.count} équipes. Les poules seront automatiquement équilibrées (~4 équipes par poule).`}
              action={generateGroups}
              loading={loading}
              label="Lancer le tirage"
              disabled={stats.count < 4}
            />
          )}

          {/* Lien vers saisie des scores de poule */}
          {tournament?.status === 'group_stage' && (
            <Link to="/admin/groupes" className="card hover:border-white/30 transition-colors block">
              <h3 className="font-bold text-lg mb-1">Saisir les scores de poule</h3>
              <p className="text-white/50 text-sm">Entrer les résultats des matchs de poule</p>
              <span className="text-primary-400 text-sm mt-3 inline-block">Accéder →</span>
            </Link>
          )}

          {/* Générer le bracket */}
          {tournament?.status === 'group_stage' && (
            <ActionCard
              title="Clôturer les poules et générer les brackets"
              desc="Qualifie automatiquement les meilleures équipes et génère le bracket principal + consolante."
              action={generateBracket}
              loading={loading}
              label="Générer les brackets"
            />
          )}

          {/* Lien vers bracket */}
          {tournament?.status === 'knockout' && (
            <Link to="/admin/bracket" className="card hover:border-white/30 transition-colors block">
              <h3 className="font-bold text-lg mb-1">Saisir les scores du bracket</h3>
              <p className="text-white/50 text-sm">Entrer les résultats de la phase finale</p>
              <span className="text-primary-400 text-sm mt-3 inline-block">Accéder →</span>
            </Link>
          )}
        </div>

        {/* Liens navigation */}
        <div className="grid md:grid-cols-3 gap-4">
          <Link to="/admin/equipes" className="card hover:border-white/20 transition-colors text-center">
            <div className="text-2xl mb-1">👥</div>
            <div className="font-semibold">Équipes</div>
            <div className="text-white/40 text-xs">Gérer les inscriptions</div>
          </Link>
          {user?.role === 'super_admin' && (
            <Link to="/admin/admins" className="card hover:border-white/20 transition-colors text-center">
              <div className="text-2xl mb-1">🔑</div>
              <div className="font-semibold">Administrateurs</div>
              <div className="text-white/40 text-xs">Gérer les comptes admin</div>
            </Link>
          )}
          <Link to="/" className="card hover:border-white/20 transition-colors text-center">
            <div className="text-2xl mb-1">👁️</div>
            <div className="font-semibold">Vue publique</div>
            <div className="text-white/40 text-xs">Voir le site comme un joueur</div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card">
      <div className="text-2xl font-display font-black text-primary-400">{value}</div>
      <div className="text-white/50 text-xs mt-1">{label}</div>
    </div>
  );
}

function ActionCard({ title, desc, action, loading, label, disabled }) {
  return (
    <div className="card">
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-white/50 text-sm mb-4">{desc}</p>
      <button
        onClick={action}
        disabled={loading || disabled}
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'En cours...' : label}
      </button>
    </div>
  );
}
