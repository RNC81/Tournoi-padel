import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { formatTeamName } from '../utils/formatTeam';
import ConfirmModal from '../components/admin/ConfirmModal';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Pays/ville en texte libre → juste les 2 premières lettres majuscules comme indicateur visuel
// Si le texte fait exactement 2 lettres on tente le drapeau emoji, sinon on affiche le texte court
function flag(country) {
  if (!country) return '';
  const upper = country.trim().toUpperCase();
  if (upper.length === 2) {
    // Tentative drapeau emoji (fonctionne pour les codes ISO)
    return Array.from(upper)
      .map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)))
      .join('');
  }
  // Texte libre : afficher l'initiale majuscule
  return upper.slice(0, 2);
}

const PATH_STYLE = {
  main:       'bg-gold-500/15 text-gold-400',
  consolante: 'bg-purple-500/15 text-purple-400',
  eliminated: 'bg-white/5 text-white/25 line-through',
};
const PATH_LABEL = {
  main: 'Bracket', consolante: 'Consolante', eliminated: 'Éliminé',
};

function PathBadge({ path }) {
  if (!path) return <span className="text-white/20 text-xs">—</span>;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PATH_STYLE[path] || 'text-white/30'}`}>
      {PATH_LABEL[path] || path}
    </span>
  );
}

// ─── MODAL WRAPPER ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative bg-dark-800 border border-white/15 rounded-xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} mb-8`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="font-display font-bold text-lg text-white">{title}</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── FORMULAIRE ÉQUIPE (créer + éditer) ───────────────────────────────────────
// name      : optionnel — auto-généré "[NomJ1] / [NomJ2]" si vide
// country   : texte libre — ville ou pays en toutes lettres

function TeamForm({ initial = {}, onSave, onCancel, loading }) {
  const [form, setForm] = useState({
    name:    initial.name    || '',
    player1: initial.player1 || '',
    player2: initial.player2 || '',
    country: initial.country || '',
    notes:   initial.notes   || '',
  });
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      <div>
        <label className="block text-xs text-white/50 mb-1.5">
          Nom de l'équipe <span className="text-white/25">(optionnel)</span>
        </label>
        <input
          className="input"
          value={form.name}
          onChange={set('name')}
          placeholder="Auto-généré si vide (ex : Dinmamod / Jawad)"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Joueur 1</label>
          <input className="input" value={form.player1} onChange={set('player1')} required placeholder="Prénom Nom" />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Joueur 2</label>
          <input className="input" value={form.player2} onChange={set('player2')} required placeholder="Prénom Nom" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-white/50 mb-1.5">
          Pays / Ville
          {form.country && <span className="ml-2 text-white/40 text-xs">{flag(form.country)}</span>}
        </label>
        <input
          className="input"
          value={form.country}
          onChange={set('country')}
          placeholder="Paris, London, Dubaï, Madagascar..."
        />
      </div>
      <div>
        <label className="block text-xs text-white/50 mb-1.5">Notes internes <span className="text-white/25">(optionnel)</span></label>
        <input className="input" value={form.notes} onChange={set('notes')} placeholder="Numéro de contact, remarques..." />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={loading} className="btn-primary text-sm px-5 py-2 disabled:opacity-50">
          {loading ? 'Sauvegarde...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}

// ─── MODAL DÉPLACER GROUPE ────────────────────────────────────────────────────

function MoveGroupModal({ team, groups, onClose, onMoved }) {
  const [groupId, setGroupId]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState('');

  const handleMove = async () => {
    if (!groupId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.put(`/teams/${team._id}/move-group`, { groupId });
      onMoved(res.data.warning);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
      setLoading(false);
    }
  };

  const available = groups.filter(g => g.phase === 'pool');

  return (
    <Modal title={`Déplacer : ${team.name}`} onClose={onClose}>
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}
      <p className="text-white/50 text-sm mb-4">
        Groupe actuel : <span className="text-white/80">{team.group?.name || '—'}</span>
      </p>
      <label className="block text-xs text-white/50 mb-1.5">Nouveau groupe</label>
      <select
        className="input mb-5"
        value={groupId}
        onChange={e => setGroupId(e.target.value)}
      >
        <option value="">— Choisir un groupe —</option>
        {available.map(g => (
          <option key={g._id} value={g._id}>
            Groupe {g.name} ({g.teams?.length ?? 0} équipes)
          </option>
        ))}
      </select>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Annuler</button>
        <button onClick={handleMove} disabled={!groupId || loading} className="btn-primary text-sm px-5 py-2 disabled:opacity-50">
          {loading ? 'Déplacement...' : 'Déplacer'}
        </button>
      </div>
    </Modal>
  );
}

// ─── WIZARD IMPORT CSV ────────────────────────────────────────────────────────

// Champs de mapping : les 4 premiers sont requis (player1 OU player1_first/last, idem player2)
const MAPPING_FIELDS = [
  { key: 'player1_first', label: 'Prénom capitaine',   required: true,  group: 1 },
  { key: 'player1_last',  label: 'Nom capitaine',      required: true,  group: 1 },
  { key: 'player2_first', label: 'Prénom binôme',      required: true,  group: 2 },
  { key: 'player2_last',  label: 'Nom binôme',         required: true,  group: 2 },
  { key: 'country',       label: 'Pays / Ville',       required: true,  group: 3 },
  { key: 'name',          label: "Nom d'équipe",       required: false, group: 3 },
  { key: 'notes',         label: 'Notes',              required: false, group: 3 },
];

// Détection automatique des colonnes CSV par mots-clés
// Normalisation : NFD + suppression des accents + lowercase
function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function autoDetect(columns) {
  const detected = {};
  for (const col of columns) {
    const n = normalize(col);
    // Ignorer les colonnes non pertinentes
    if (/tel|phone|age|date|email|mail/.test(n)) continue;

    if (/prenom.*(cap|1|equip)/.test(n) || /^prenom$/.test(n) || n === 'prenom 1' || n === 'prenom joueur 1') {
      detected.player1_first = col;
    } else if (/nom.*(cap|1)/.test(n) || /^nom cap/.test(n)) {
      detected.player1_last = col;
    } else if (/prenom.*(bin|2|partenaire)/.test(n) || n === 'prenom 2' || n === 'prenom joueur 2') {
      detected.player2_first = col;
    } else if (/nom.*(bin|2|partenaire)/.test(n) || /^nom bin/.test(n)) {
      detected.player2_last = col;
    } else if (/pays|ville|city|country/.test(n)) {
      detected.country = col;
    } else if (/^nom equipe/.test(n) || /^nom d.equipe/.test(n)) {
      detected.name = col;
    } else if (/note/.test(n)) {
      detected.notes = col;
    }
  }

  // Fallback générique si détection précise a raté
  // "Prénom" seul → player1_first si pas encore assigné
  for (const col of columns) {
    const n = normalize(col);
    if (!detected.player1_first && /^prenom/.test(n)) detected.player1_first = col;
    if (!detected.player1_last  && /^nom$/.test(n))  detected.player1_last  = col;
  }

  return detected;
}

function CsvWizard({ onClose, onImported }) {
  const [step,    setStep]    = useState(1);
  const [file,    setFile]    = useState(null);
  const [parsed,  setParsed]  = useState(null);   // { columns, rows, rowCount }
  const [mapping, setMapping] = useState({});      // { player1_first: 'col_csv', ... }
  const [results, setResults] = useState(null);   // { imported, skipped, errors }
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Étape 1 — upload + parse + auto-détection
  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/teams/import-csv/parse', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setParsed(res.data);
      // Auto-détecter le mapping dès réception des colonnes
      setMapping(autoDetect(res.data.columns));
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de lire le fichier');
    } finally {
      setLoading(false);
    }
  };

  // Étape 2 → 3 — confirmation import
  const handleConfirm = async () => {
    // Vérifier que player1 et player2 ont au moins un champ mappé
    const hasPlayer1 = mapping.player1 || mapping.player1_first || mapping.player1_last;
    const hasPlayer2 = mapping.player2 || mapping.player2_first || mapping.player2_last;
    const hasCountry = mapping.country;
    const errors = [];
    if (!hasPlayer1) errors.push('Prénom ou Nom du capitaine');
    if (!hasPlayer2) errors.push('Prénom ou Nom du binôme');
    if (!hasCountry) errors.push('Pays / Ville');
    if (errors.length > 0) {
      setError(`Champs obligatoires non mappés : ${errors.join(', ')}`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/teams/import-csv/confirm', {
        rows: parsed.rows,
        mapping,
      });
      setResults(res.data);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'import");
    } finally {
      setLoading(false);
    }
  };

  const preview = parsed?.rows?.slice(0, 3) || [];

  // Valeur exemple pour un champ du mapping (1ère ligne du CSV)
  const previewValue = (key) => {
    if (!mapping[key] || !preview[0]) return null;
    return preview[0][mapping[key]] || null;
  };

  return (
    <Modal title="Importer des équipes via CSV" onClose={onClose} wide>
      {/* Indicateur d'étapes */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((n, i) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === n ? 'bg-primary-500 text-white' :
              step > n  ? 'bg-primary-500/30 text-primary-400' :
                          'bg-white/10 text-white/30'
            }`}>
              {step > n ? '✓' : n}
            </div>
            <span className={`text-xs ${step === n ? 'text-white' : 'text-white/30'}`}>
              {['Upload', 'Mapping', 'Résultat'][i]}
            </span>
            {i < 2 && <div className="w-8 h-px bg-white/10 mx-1" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {/* ── Étape 1 : Upload ── */}
      {step === 1 && (
        <div>
          <p className="text-white/40 text-sm mb-4">
            Format attendu : CSV avec virgule ou point-virgule. La première ligne doit contenir les en-têtes de colonnes.
          </p>
          <label className="block">
            <div className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              file ? 'border-primary-500/50 bg-primary-500/5' : 'border-white/15 hover:border-white/30'
            }`}>
              <div className="text-3xl mb-2">📄</div>
              {file ? (
                <div>
                  <div className="text-white font-medium text-sm">{file.name}</div>
                  <div className="text-white/40 text-xs mt-1">{(file.size / 1024).toFixed(1)} Ko</div>
                </div>
              ) : (
                <div>
                  <div className="text-white/60 text-sm">Cliquez pour choisir un fichier</div>
                  <div className="text-white/30 text-xs mt-1">.csv · max 5 Mo</div>
                </div>
              )}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => { setFile(e.target.files[0]); setError(''); }}
              />
            </div>
          </label>
          <div className="flex justify-end mt-5">
            <button
              onClick={handleParse}
              disabled={!file || loading}
              className="btn-primary text-sm px-5 py-2 disabled:opacity-50"
            >
              {loading ? 'Lecture...' : 'Analyser le fichier →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Étape 2 : Mapping des colonnes ── */}
      {step === 2 && parsed && (
        <div>
          <p className="text-white/40 text-sm mb-1">
            <span className="text-white/70">{parsed.rowCount}</span> lignes détectées · colonnes : {parsed.columns.join(', ')}
          </p>

          {/* Aperçu des 3 premières lignes */}
          {preview.length > 0 && (
            <div className="overflow-x-auto mb-5 mt-3">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    {parsed.columns.map(col => (
                      <th key={col} className="text-left px-2 py-1.5 text-white/40 border-b border-white/10 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {parsed.columns.map(col => (
                        <td key={col} className="px-2 py-1.5 text-white/60 whitespace-nowrap max-w-32 truncate">
                          {row[col] || <span className="text-white/20">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rowCount > 3 && (
                <p className="text-white/20 text-xs mt-1.5 px-1">… et {parsed.rowCount - 3} autres lignes</p>
              )}
            </div>
          )}

          <p className="text-white/60 text-sm font-medium mb-3">
            Associer les colonnes CSV aux champs ·
            <span className="text-primary-400 font-normal ml-1">mapping auto-détecté — corrigez si besoin</span>
          </p>

          {/* Groupes de champs : Capitaine / Binôme / Autres */}
          {[
            { label: 'Capitaine (Joueur 1)', keys: ['player1_first', 'player1_last'] },
            { label: 'Binôme (Joueur 2)',    keys: ['player2_first', 'player2_last'] },
            { label: 'Autres champs',        keys: ['country', 'name', 'notes'] },
          ].map(section => (
            <div key={section.label} className="mb-5">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-2">{section.label}</p>
              <div className="space-y-2">
                {MAPPING_FIELDS.filter(f => section.keys.includes(f.key)).map(field => (
                  <div key={field.key} className="flex items-center gap-3">
                    <label className="text-sm w-36 flex-shrink-0 text-white/70">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    <select
                      className="input flex-1 text-sm py-1.5"
                      value={mapping[field.key] || ''}
                      onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value || undefined }))}
                    >
                      <option value="">— Non mappé —</option>
                      {parsed.columns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    {/* Aperçu valeur 1ère ligne */}
                    <span className="text-white/30 text-xs w-28 truncate flex-shrink-0">
                      {previewValue(field.key) ? `ex : ${previewValue(field.key)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex gap-3 justify-between mt-6">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-white/40 hover:text-white transition-colors">
              ← Retour
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="btn-primary text-sm px-5 py-2 disabled:opacity-50"
            >
              {loading ? 'Import en cours...' : `Importer ${parsed.rowCount} équipes →`}
            </button>
          </div>
        </div>
      )}

      {/* ── Étape 3 : Résultats ── */}
      {step === 3 && results && (
        <div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-4 text-center">
              <div className="font-display font-black text-3xl text-primary-400">{results.imported}</div>
              <div className="text-white/50 text-sm mt-1">équipes importées</div>
            </div>
            <div className={`border rounded-xl p-4 text-center ${
              results.skipped > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'
            }`}>
              <div className={`font-display font-black text-3xl ${results.skipped > 0 ? 'text-red-400' : 'text-white/30'}`}>
                {results.skipped}
              </div>
              <div className="text-white/50 text-sm mt-1">lignes ignorées</div>
            </div>
          </div>

          {results.errors?.length > 0 && (
            <div className="bg-dark-700 rounded-xl p-4 mb-5 max-h-48 overflow-y-auto">
              <p className="text-white/50 text-xs font-medium mb-2 uppercase tracking-wide">Détail des erreurs</p>
              {results.errors.map((e, i) => (
                <div key={i} className="text-xs text-white/50 py-1 border-b border-white/5 last:border-0">
                  <span className="text-white/30">Ligne {e.row} :</span> {e.reason}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={() => { setStep(1); setFile(null); setParsed(null); setResults(null); setMapping({}); }} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">
              Nouvel import
            </button>
            <button onClick={() => { onImported(); onClose(); }} className="btn-primary text-sm px-5 py-2">
              Fermer et rafraîchir
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────

export default function AdminTeamsPage() {
  const [teams,   setTeams]   = useState([]);
  const [groups,  setGroups]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null); // { type, msg }

  // État des modals
  const [modal,    setModal]    = useState(null);  // 'create'|'edit'|'delete'|'move'|'csv'
  const [selected, setSelected] = useState(null);  // team courante
  const [saving,   setSaving]   = useState(false);

  // Highlight via ?highlight=teamId (depuis la page Poules → bouton ↔)
  const [searchParams]    = useSearchParams();
  const highlightId       = searchParams.get('highlight');
  const highlightRef      = useRef(null);
  const [ringActive, setRingActive] = useState(!!highlightId);

  // Quand les équipes sont chargées : scroll + ring 3 secondes puis retire
  useEffect(() => {
    if (!highlightId || loading) return;
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setRingActive(true);
    const timer = setTimeout(() => setRingActive(false), 3000);
    return () => clearTimeout(timer);
  }, [highlightId, loading]);

  // ── Chargement ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    try {
      const [teamsRes, groupsRes] = await Promise.all([
        api.get('/teams'),
        api.get('/groups').catch(() => ({ data: [] })),
      ]);
      setTeams(teamsRes.data);
      setGroups(groupsRes.data);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const closeModal = () => { setModal(null); setSelected(null); };

  // ── Créer ─────────────────────────────────────────────────────────────────
  const handleCreate = async (data) => {
    setSaving(true);
    try {
      await api.post('/teams', data);
      await fetchAll();
      closeModal();
      showToast('ok', `Équipe "${data.name}" créée.`);
    } finally { setSaving(false); }
  };

  // ── Éditer ────────────────────────────────────────────────────────────────
  const handleEdit = async (data) => {
    setSaving(true);
    try {
      await api.put(`/teams/${selected._id}`, data);
      await fetchAll();
      closeModal();
      showToast('ok', `Équipe "${data.name}" mise à jour.`);
    } finally { setSaving(false); }
  };

  // ── Supprimer ─────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/teams/${selected._id}`);
      await fetchAll();
      closeModal();
      showToast('ok', `Équipe supprimée.`);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Erreur lors de la suppression');
      closeModal();
    } finally { setSaving(false); }
  };

  // ── Déplacer groupe ───────────────────────────────────────────────────────
  const handleMoved = (warning) => {
    fetchAll();
    closeModal();
    if (warning) showToast('warn', warning);
    else showToast('ok', 'Équipe déplacée.');
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-40 max-w-sm px-4 py-3 rounded-lg text-sm shadow-lg flex items-start gap-3 ${
          toast.type === 'ok'   ? 'bg-primary-500/20 border border-primary-500/40 text-primary-300' :
          toast.type === 'warn' ? 'bg-gold-500/20 border border-gold-500/40 text-gold-300' :
                                  'bg-red-500/20 border border-red-500/40 text-red-300'
        }`}>
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="text-current opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Équipes</h1>
          <p className="text-white/30 text-sm mt-0.5">
            {loading ? '...' : `${teams.length} équipe${teams.length !== 1 ? 's' : ''} inscrite${teams.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal('csv')}
            className="px-4 py-2 rounded-lg border border-white/15 text-sm text-white/70 hover:text-white hover:border-white/30 transition-colors"
          >
            Importer CSV
          </button>
          <button onClick={() => setModal('create')} className="btn-primary text-sm px-4 py-2">
            + Ajouter
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-white/30 text-sm">Chargement...</div>
      ) : teams.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">🎾</div>
          <p className="text-white/50 text-sm">Aucune équipe inscrite.</p>
          <p className="text-white/30 text-xs mt-1">Ajoutez des équipes manuellement ou importez un fichier CSV.</p>
        </div>
      ) : (
        <div className="bg-dark-800 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Pays</th>
                  <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Équipe</th>
                  <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Joueurs</th>
                  <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Groupe</th>
                  <th className="text-left px-4 py-3 text-xs text-white/40 font-medium uppercase tracking-wide">Chemin</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {teams.map((team, i) => {
                  const isHighlighted = team._id === highlightId;
                  return (
                  <tr
                    key={team._id}
                    ref={isHighlighted ? highlightRef : null}
                    className={`border-b border-white/5 last:border-0 hover:bg-white/3 transition-all ${
                      isHighlighted && ringActive
                        ? 'ring-2 ring-yellow-400 ring-inset bg-yellow-400/5'
                        : i % 2 === 0 ? '' : 'bg-white/[0.02]'
                    }`}
                  >
                    <td className="px-4 py-3 text-xl">{flag(team.country)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white text-sm">
                        {formatTeamName(team.player1, team.player2) || team.name}
                      </div>
                      <div className="text-white/30 text-xs">{team.country}</div>
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      <div>{team.player1}</div>
                      <div>{team.player2}</div>
                    </td>
                    <td className="px-4 py-3">
                      {team.group ? (
                        <span className="bg-dark-700 text-white/60 text-xs px-2 py-0.5 rounded">
                          Groupe {team.group.name}
                        </span>
                      ) : (
                        <span className="text-white/20 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PathBadge path={team.tournamentPath} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <ActionBtn
                          label="Déplacer"
                          disabled={groups.filter(g => g.phase === 'pool').length === 0}
                          onClick={() => { setSelected(team); setModal('move'); }}
                        />
                        <ActionBtn
                          label="Éditer"
                          onClick={() => { setSelected(team); setModal('edit'); }}
                        />
                        <ActionBtn
                          label="Suppr."
                          danger
                          onClick={() => { setSelected(team); setModal('delete'); }}
                        />
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────── */}

      {modal === 'create' && (
        <Modal title="Ajouter une équipe" onClose={closeModal}>
          <TeamForm onSave={handleCreate} onCancel={closeModal} loading={saving} />
        </Modal>
      )}

      {modal === 'edit' && selected && (
        <Modal title={`Modifier : ${selected.name}`} onClose={closeModal}>
          <TeamForm initial={selected} onSave={handleEdit} onCancel={closeModal} loading={saving} />
        </Modal>
      )}

      {modal === 'delete' && selected && (
        <ConfirmModal
          title="Supprimer l'équipe"
          message={`Supprimer "${selected.name}" (${selected.player1} / ${selected.player2}) ? Les matchs existants ne seront pas supprimés.`}
          onConfirm={handleDelete}
          onCancel={closeModal}
          loading={saving}
          danger
        />
      )}

      {modal === 'move' && selected && (
        <MoveGroupModal
          team={selected}
          groups={groups}
          onClose={closeModal}
          onMoved={handleMoved}
        />
      )}

      {modal === 'csv' && (
        <CsvWizard onClose={closeModal} onImported={fetchAll} />
      )}
    </div>
  );
}

// Bouton d'action dans le tableau
function ActionBtn({ label, onClick, danger = false, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Aucun groupe disponible' : undefined}
      className={`px-2 py-1 rounded text-xs transition-colors disabled:opacity-25 disabled:cursor-not-allowed ${
        danger
          ? 'text-red-400/70 hover:text-red-400 hover:bg-red-500/10'
          : 'text-white/40 hover:text-white hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  );
}
