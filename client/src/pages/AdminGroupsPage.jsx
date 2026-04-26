import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatTeamName } from '../utils/formatTeam';
import ConfirmModal from '../components/admin/ConfirmModal';

// ─── UTILITAIRES ──────────────────────────────────────────────────────────────

function rankColor(rank, total) {
  if (rank === 1) return 'text-yellow-400';
  if (rank === 2) return 'text-white/70';
  if (rank <= Math.ceil(total * 0.5)) return 'text-primary-400';
  return 'text-white/30';
}

// ─── MODAL SCORE ─────────────────────────────────────────────────────────────

function ScoreModal({ match, setFormat, onClose, onSaved }) {
  const maxSets = setFormat?.maxSets ?? 3;

  const initSets = () => {
    const existing = match.sets || [];
    return Array.from({ length: maxSets }, (_, i) => ({
      score1: existing[i]?.score1 ?? '',
      score2: existing[i]?.score2 ?? '',
    }));
  };

  const [sets,    setSets]    = useState(initSets);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const team1Label = formatTeamName(match.team1?.player1, match.team1?.player2) || match.team1?.name || 'Équipe 1';
  const team2Label = formatTeamName(match.team2?.player1, match.team2?.player2) || match.team2?.name || 'Équipe 2';

  const updateSet = (i, field, val) => {
    setSets(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val === '' ? '' : parseInt(val, 10) };
      return next;
    });
  };

  const handleSave = async () => {
    // 0 est un score valide — vérification via !== '' et non !value
    const filledSets = sets.filter(s => s.score1 !== '' && s.score2 !== '');
    if (filledSets.length === 0) {
      setError('Saisissez au moins un set joué');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.put(`/matches/${match._id}/score`, { sets: filledSets });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await api.delete(`/matches/${match._id}/score`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la réinitialisation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-dark-800 border border-white/15 rounded-2xl shadow-2xl w-full max-w-md p-6">

        <h3 className="font-display font-bold text-lg text-white mb-1">Saisie du score</h3>
        <p className="text-white/40 text-sm mb-5">
          {team1Label} <span className="text-white/20 mx-1">vs</span> {team2Label}
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-3 py-2 mb-4">{error}</div>
        )}

        <div className="grid grid-cols-[1fr_2.5rem_1fr] gap-2 mb-2 text-xs text-white/30 text-center">
          <span className="text-right pr-2 truncate">{team1Label}</span>
          <span />
          <span className="text-left pl-2 truncate">{team2Label}</span>
        </div>

        <div className="space-y-2 mb-6">
          {sets.map((set, i) => (
            <div key={i} className="grid grid-cols-[1fr_2.5rem_1fr] items-center gap-2">
              <input type="number" min="0" max="99" placeholder="—" value={set.score1}
                onChange={e => updateSet(i, 'score1', e.target.value)}
                className="input text-center text-lg font-bold py-2" />
              <div className="text-white/20 text-center text-sm font-bold">S{i + 1}</div>
              <input type="number" min="0" max="99" placeholder="—" value={set.score2}
                onChange={e => updateSet(i, 'score2', e.target.value)}
                className="input text-center text-lg font-bold py-2" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          {match.played && (
            <button onClick={handleReset} disabled={loading}
              className="px-3 py-2 text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50">
              Réinitialiser
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-white/40 hover:text-white transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} disabled={loading}
              className="btn-primary text-sm px-5 py-2 disabled:opacity-50">
              {loading ? 'Sauvegarde...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CARTE GROUPE ─────────────────────────────────────────────────────────────

function GroupCard({ group, setFormat, onScoreClick, onRefresh }) {
  const navigate = useNavigate();
  const { standings = [], matches = [] } = group;

  return (
    <div className="bg-dark-800 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
        <div>
          <span className="font-display font-black text-xl text-white">Poule {group.name}</span>
          <span className="text-white/30 text-sm ml-2">{group.teams?.length || 0} équipes</span>
        </div>
        <div className="text-xs text-white/20 uppercase tracking-wider">
          {matches.filter(m => m.played).length}/{matches.length} matchs joués
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/8">

        {/* ── Classement ── */}
        <div className="p-4">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Classement</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/25 text-xs">
                <th className="text-left pb-2 w-6">#</th>
                <th className="text-left pb-2">Équipe</th>
                <th className="text-center pb-2 w-8" title="Joués">J</th>
                <th className="text-center pb-2 w-8" title="Victoires">V</th>
                <th className="text-center pb-2 w-8" title="Défaites">D</th>
                <th className="text-center pb-2 w-12" title="Diff. sets">+/-</th>
                <th className="text-center pb-2 w-8 font-semibold text-white/40" title="Points">Pts</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.teamId} className={`border-t border-white/5 ${i === 0 ? 'border-t-0' : ''}`}>
                  <td className={`py-2 font-bold text-sm ${rankColor(s.rank, standings.length)}`}>{s.rank}</td>
                  <td className="py-2 text-white/80 max-w-0 w-full pr-2">
                    <div className="truncate text-xs">
                      {formatTeamName(s.team?.player1, s.team?.player2) || s.team?.name || '—'}
                    </div>
                    <div className="text-white/30 text-xs truncate">{s.team?.country || ''}</div>
                  </td>
                  <td className="py-2 text-center text-white/50">{s.played}</td>
                  <td className="py-2 text-center text-white/50">{s.won}</td>
                  <td className="py-2 text-center text-white/50">{s.lost}</td>
                  <td className={`py-2 text-center text-xs ${
                    s.setDiff > 0 ? 'text-primary-400' : s.setDiff < 0 ? 'text-red-400/70' : 'text-white/30'
                  }`}>
                    {s.setDiff > 0 ? `+${s.setDiff}` : s.setDiff}
                  </td>
                  <td className="py-2 text-center font-bold text-white">{s.points}</td>
                  {/* ↔ redirige vers /admin/teams?highlight=id — plus simple qu'un modal */}
                  <td className="py-2 text-right">
                    {s.team && (
                      <button
                        onClick={() => navigate(`/admin/teams?highlight=${s.team._id}`)}
                        className="text-xs text-white/20 hover:text-white/60 transition-colors px-1 py-0.5 rounded hover:bg-white/5"
                        title="Voir et déplacer dans la page Équipes"
                      >
                        ↔
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Matchs ── */}
        <div className="p-4">
          <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Matchs</p>
          <div className="space-y-2">
            {matches.map(match => {
              const t1 = formatTeamName(match.team1?.player1, match.team1?.player2) || match.team1?.name || '—';
              const t2 = formatTeamName(match.team2?.player1, match.team2?.player2) || match.team2?.name || '—';
              return (
                <button
                  key={match._id}
                  onClick={() => onScoreClick(match)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all hover:border-white/20 ${
                    match.played ? 'border-white/10 bg-white/3' : 'border-white/6 bg-white/1 hover:bg-white/5'
                  }`}
                >
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                    <div className={`truncate ${match.result === 'team1' ? 'text-white font-semibold' : 'text-white/60'}`}>
                      {t1}
                    </div>
                    <div className="text-center min-w-fit">
                      {match.played ? (
                        <div className="flex items-center gap-1">
                          {(match.sets || []).map((s, i) => (
                            <span key={i} className="text-xs text-white/40 font-mono">
                              {i > 0 && <span className="text-white/15 mr-1">·</span>}
                              <span className={s.score1 > s.score2 ? 'text-white/70' : ''}>{s.score1}</span>
                              <span className="text-white/20">-</span>
                              <span className={s.score2 > s.score1 ? 'text-white/70' : ''}>{s.score2}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-white/20 text-xs">vs</span>
                      )}
                    </div>
                    <div className={`truncate text-right ${match.result === 'team2' ? 'text-white font-semibold' : 'text-white/60'}`}>
                      {t2}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FORMULAIRE DE TIRAGE ─────────────────────────────────────────────────────

function DrawForm({ eligibleCount, phase, onDrawn }) {
  const [mode,     setMode]     = useState('byGroups'); // 'byGroups' | 'bySize'
  const [inputVal, setInputVal] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [warnings, setWarnings] = useState([]);

  // Preview calculé en temps réel selon le mode
  const preview = (() => {
    const val = parseInt(inputVal, 10);
    if (!val || !eligibleCount) return null;
    if (mode === 'byGroups') {
      return { numGroups: val, groupSize: Math.ceil(eligibleCount / val) };
    }
    return { numGroups: Math.ceil(eligibleCount / val), groupSize: val };
  })();

  // Suggestions (toujours converties en numGroups)
  const suggestions = (() => {
    const n = eligibleCount;
    if (!n || n < 4) return [];
    const opts = [];
    const tried = new Set();
    for (const targetSize of [4, 5, 3]) {
      const ng = Math.round(n / targetSize);
      if (ng < 1 || tried.has(ng)) continue;
      tried.add(ng);
      const sz  = Math.ceil(n / ng);
      if (sz < 3) continue;
      const rem = n - (ng - 1) * sz;
      opts.push({
        ng,
        label: rem === sz
          ? `${ng} poules de ${sz} équipes`
          : `${ng} poules (~${sz} éq., dernier groupe : ${rem})`,
      });
    }
    return opts.slice(0, 3);
  })();

  const handleDraw = async (overrideNumGroups) => {
    setError('');
    const numGroups = overrideNumGroups ?? preview?.numGroups;
    if (!numGroups || numGroups < 1) { setError('Saisissez une valeur valide'); return; }
    const groupSize = Math.ceil(eligibleCount / numGroups);
    if (groupSize < 3) {
      setError(
        `Impossible : ${numGroups} poules pour ${eligibleCount} équipes = ` +
        `${groupSize} équipe${groupSize > 1 ? 's' : ''} par poule. Minimum 3.`
      );
      return;
    }
    setLoading(true);
    setWarnings([]);
    try {
      const res = await api.post('/groups/draw', { phase, numGroups });
      if (res.data.warnings?.length) setWarnings(res.data.warnings);
      onDrawn();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du tirage');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-dark-800 border border-white/10 rounded-2xl p-6">
        <h2 className="font-display font-bold text-xl text-white mb-1">Lancer le tirage au sort</h2>
        <p className="text-white/40 text-sm mb-6">{eligibleCount} équipes éligibles détectées</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}
        {warnings.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 mb-4 space-y-1">
            <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wide mb-1">Conflits pays/ville détectés</p>
            {warnings.map((w, i) => <p key={i} className="text-yellow-400/70 text-xs">{w}</p>)}
          </div>
        )}

        {/* Suggestions cliquables */}
        {suggestions.length > 0 && (
          <div className="mb-6">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Configurations suggérées</p>
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => handleDraw(s.ng)} disabled={loading}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 hover:border-primary-500/50 hover:bg-primary-500/5 transition-all text-left disabled:opacity-50">
                  <span className="text-white text-sm">{s.label}</span>
                  <span className="text-primary-400 text-xs">Lancer →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Double option manuelle */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Ou définir manuellement</p>

          {/* Tabs mode A / B */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden mb-3">
            {[
              { val: 'byGroups', label: 'Nombre de poules' },
              { val: 'bySize',   label: 'Équipes par poule' },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => { setMode(opt.val); setInputVal(''); setError(''); }}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  mode === opt.val
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <input
                type="number"
                min="1"
                max={mode === 'byGroups' ? '50' : '30'}
                placeholder={mode === 'byGroups' ? 'Ex : 5 poules' : 'Ex : 8 équipes'}
                value={inputVal}
                onChange={e => { setInputVal(e.target.value); setError(''); }}
                className="input w-full text-sm py-2"
              />
              {preview && (
                <p className={`text-xs mt-1.5 ${preview.groupSize < 3 ? 'text-red-400' : 'text-white/30'}`}>
                  {mode === 'byGroups'
                    ? `→ ${preview.numGroups} poules de ~${preview.groupSize} équipes`
                    : `→ ~${preview.numGroups} poules de ${preview.groupSize} équipes`}
                  {preview.groupSize < 3 ? ' — trop peu (min. 3)' : ''}
                </p>
              )}
            </div>
            <button
              onClick={() => handleDraw()}
              disabled={!inputVal || loading}
              className="btn-primary text-sm px-5 py-2 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'Tirage...' : 'Tirer au sort'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

export default function AdminGroupsPage() {
  const [groups,        setGroups]        = useState([]);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [setFormat,     setSetFormat]     = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState(null);
  const [scoreMatch,    setScoreMatch]    = useState(null);
  const [confirmRegen,  setConfirmRegen]  = useState(false);
  const [regenLoading,  setRegenLoading]  = useState(false);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [groupsRes, teamsRes, tourRes] = await Promise.allSettled([
        api.get('/groups?phase=pool'),
        api.get('/teams'),
        api.get('/tournament'),
      ]);

      if (groupsRes.status === 'fulfilled') {
        const groupList = groupsRes.value.data;
        if (groupList.length > 0) {
          const details = await Promise.all(
            groupList.map(g => api.get(`/groups/${g._id}`).then(r => r.data).catch(() => g))
          );
          setGroups(details);
        } else {
          setGroups([]);
        }
      }

      if (teamsRes.status === 'fulfilled') {
        setEligibleCount(teamsRes.value.data.filter(t => !t.group).length);
      }

      if (tourRes.status === 'fulfilled') {
        setSetFormat(tourRes.value.data.poolStageFormat || null);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRegenerate = async () => {
    setRegenLoading(true);
    try {
      await api.post('/groups/regenerate', { confirm: true, phase: 'pool' });
      setGroups([]);
      setConfirmRegen(false);
      showToast('ok', 'Tirage supprimé. Vous pouvez relancer le tirage.');
      await fetchAll();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setRegenLoading(false);
    }
  };

  const hasGroups = groups.length > 0;

  if (loading) return <div className="p-8 text-white/30 text-sm">Chargement...</div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl ${
          toast.type === 'ok' ? 'bg-primary-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Poules</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {hasGroups
              ? `${groups.length} poule${groups.length > 1 ? 's' : ''} · ${groups.reduce((s, g) => s + (g.matches?.length || 0), 0)} matchs`
              : 'Aucun tirage effectué'}
          </p>
        </div>
        {hasGroups && (
          <button onClick={() => setConfirmRegen(true)}
            className="px-4 py-2 text-sm text-red-400/70 hover:text-red-400 border border-red-400/20 hover:border-red-400/40 rounded-lg transition-all">
            Refaire le tirage
          </button>
        )}
      </div>

      {!hasGroups && (
        <DrawForm eligibleCount={eligibleCount} phase="pool"
          onDrawn={() => { showToast('ok', 'Tirage effectué !'); fetchAll(); }} />
      )}

      {hasGroups && (
        <div className="space-y-6">
          {groups.map(group => (
            <GroupCard
              key={group._id}
              group={group}
              setFormat={setFormat}
              onScoreClick={match => setScoreMatch(match)}
              onRefresh={fetchAll}
            />
          ))}
        </div>
      )}

      {scoreMatch && (
        <ScoreModal
          match={scoreMatch}
          setFormat={setFormat}
          onClose={() => setScoreMatch(null)}
          onSaved={() => { showToast('ok', 'Score enregistré'); fetchAll(); }}
        />
      )}

      {confirmRegen && (
        <ConfirmModal
          title="Refaire le tirage ?"
          message="Tous les groupes et matchs de poule seront supprimés définitivement. Les scores déjà saisis seront perdus."
          danger
          loading={regenLoading}
          onConfirm={handleRegenerate}
          onCancel={() => setConfirmRegen(false)}
        />
      )}
    </div>
  );
}
