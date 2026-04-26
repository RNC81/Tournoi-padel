import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import StatusBadge from '../components/admin/StatusBadge';
import api from '../utils/api';

// ─── ACTIONS DE STATUT ────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'setup',        label: 'Configuration'    },
  { value: 'registration', label: 'Inscriptions'     },
  { value: 'pool_stage',   label: 'Phase de poules'  },
  { value: 'knockout',     label: 'Bracket principal' },
  { value: 'consolante',   label: 'Consolante'       },
  { value: 'finished',     label: 'Terminé'          },
];

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { user } = useAuth();

  const [tournament, setTournament] = useState(null);
  const [teamCount,  setTeamCount]  = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [matchStats, setMatchStats] = useState({ played: 0, total: 0 });
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState(null); // { type: 'ok'|'error', msg }

  // ── Chargement des données ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [tourRes, teamsRes, groupsRes, matchesRes] = await Promise.allSettled([
        api.get('/tournament'),
        api.get('/teams'),
        api.get('/groups'),
        api.get('/matches?phase=pool'),
      ]);

      if (tourRes.status === 'fulfilled')   setTournament(tourRes.value.data);
      if (teamsRes.status === 'fulfilled')  setTeamCount(teamsRes.value.data.length);
      if (groupsRes.status === 'fulfilled') setGroupCount(groupsRes.value.data.length);
      if (matchesRes.status === 'fulfilled') {
        const all = matchesRes.value.data;
        setMatchStats({ played: all.filter(m => m.played).length, total: all.length });
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Changement de statut ───────────────────────────────────────────────────
  const [nextStatus, setNextStatus]   = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  const handleStatusChange = async () => {
    if (!nextStatus) return;
    setStatusLoading(true);
    try {
      const res = await api.put('/tournament/status', { status: nextStatus });
      setTournament(res.data.tournament);
      setNextStatus('');
      const msg = res.data.warning
        ? `Statut mis à jour. Attention : ${res.data.warning}`
        : 'Statut mis à jour.';
      showToast('ok', msg);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Erreur');
    } finally {
      setStatusLoading(false);
    }
  };

  // ── Création du tournoi ────────────────────────────────────────────────────
  const [createLoading, setCreateLoading] = useState(false);
  const [createName,    setCreateName]    = useState('Tournoi Paris Yaar Club 2026');

  const handleCreate = async () => {
    setCreateLoading(true);
    try {
      const res = await api.post('/tournament', { name: createName });
      setTournament(res.data);
      showToast('ok', 'Tournoi créé.');
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Erreur');
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 text-white/30 text-sm">Chargement...</div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">

      {/* Toast */}
      {toast && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm flex items-start justify-between gap-4 ${
          toast.type === 'ok'
            ? 'bg-primary-500/10 border border-primary-500/30 text-primary-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-white/30 hover:text-white flex-shrink-0">✕</button>
        </div>
      )}

      {/* Titre */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl text-white">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">
          Bonjour <span className="text-white/70">{user?.username}</span>
          {user?.role === 'super_admin' && <span className="ml-2 text-gold-400 text-xs">★ super admin</span>}
        </p>
      </div>

      {/* ── Pas encore de tournoi ── */}
      {!tournament && (
        <div className="card max-w-md">
          <h2 className="font-bold text-lg text-white mb-2">Aucun tournoi configuré</h2>
          <p className="text-white/40 text-sm mb-4">Créez le tournoi pour commencer.</p>
          <input
            type="text"
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            className="input mb-3"
            placeholder="Nom du tournoi"
          />
          <button
            onClick={handleCreate}
            disabled={createLoading || !createName.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {createLoading ? 'Création...' : 'Créer le tournoi'}
          </button>
        </div>
      )}

      {/* ── Tournoi présent ── */}
      {tournament && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard value={`${teamCount} / ${tournament.maxTeams}`} label="Équipes inscrites" />
            <StatCard value={groupCount || '—'}                        label="Groupes"           />
            <StatCard value={`${matchStats.played} / ${matchStats.total}`} label="Matchs joués (poule)" />
            <div className="card flex flex-col justify-between">
              <div className="text-xs text-white/40 mb-1">Statut du tournoi</div>
              <StatusBadge status={tournament.status} />
            </div>
          </div>

          {/* Changer le statut */}
          <div className="card mb-6 max-w-lg">
            <h2 className="font-bold text-white mb-3">Changer le statut</h2>
            <div className="flex gap-2">
              <select
                value={nextStatus}
                onChange={e => setNextStatus(e.target.value)}
                className="input flex-1 text-sm"
              >
                <option value="">— Choisir un statut —</option>
                {STATUS_OPTIONS.filter(s => s.value !== tournament.status).map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={handleStatusChange}
                disabled={!nextStatus || statusLoading}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50 whitespace-nowrap"
              >
                {statusLoading ? '...' : 'Appliquer'}
              </button>
            </div>
          </div>

          {/* Accès rapide */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickLink to="/admin/teams"  label="Équipes"          sub="Gérer les inscriptions"      />
            <QuickLink to="/admin/groups" label="Poules"           sub="Tirage + saisie des scores"  />
            <QuickLink to="/admin/bracket" label="Bracket"         sub="Phase finale principale"     />
            <QuickLink to="/admin/bracket/consolante" label="Consolante" sub="Bracket des perdants"  />
            <QuickLink to="/admin/tournament" label="Config"       sub="Formats de set + règles"     />
            <QuickLink to="/tournoi"      label="Vue publique"     sub="Voir comme un joueur"  external />
          </div>
        </>
      )}
    </div>
  );
}

// ─── SOUS-COMPOSANTS ─────────────────────────────────────────────────────────

function StatCard({ value, label }) {
  return (
    <div className="card">
      <div className="font-display font-black text-2xl text-primary-400 mb-1">{value}</div>
      <div className="text-white/40 text-xs">{label}</div>
    </div>
  );
}

function QuickLink({ to, label, sub, external }) {
  const cls = "card hover:border-white/25 transition-colors cursor-pointer block";
  const inner = (
    <>
      <div className="font-semibold text-white mb-0.5">{label}</div>
      <div className="text-white/40 text-xs">{sub}</div>
    </>
  );

  if (external) {
    return <a href={to} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
  }
  return <Link to={to} className={cls}>{inner}</Link>;
}
