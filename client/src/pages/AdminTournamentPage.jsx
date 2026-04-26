// AdminTournamentPage — Configuration globale du tournoi
// 5 sections : Infos générales, Formats de set, Statut, Zone dangereuse, Clé API

import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import ConfirmModal from '../components/admin/ConfirmModal';

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUS_ORDER = ['setup', 'registration', 'pool_stage', 'knockout', 'consolante', 'finished'];

const STATUS_META = {
  setup:        { label: 'Configuration',     color: 'gray'   },
  registration: { label: 'Inscriptions',       color: 'blue'   },
  pool_stage:   { label: 'Phase de poules',    color: 'yellow' },
  knockout:     { label: 'Bracket principal',  color: 'green'  },
  consolante:   { label: 'Bracket consolante', color: 'violet' },
  finished:     { label: 'Terminé',            color: 'red'    },
};

const STATUS_COLORS = {
  gray:   { badge: 'bg-gray-500/20 text-gray-300 border-gray-500/30',     btn: 'border-gray-500/40 text-gray-300 hover:bg-gray-500/20'   },
  blue:   { badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',     btn: 'border-blue-500/40 text-blue-300 hover:bg-blue-500/20'   },
  yellow: { badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', btn: 'border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/20' },
  green:  { badge: 'bg-green-500/20 text-green-300 border-green-500/30',  btn: 'border-green-500/40 text-green-300 hover:bg-green-500/20'  },
  violet: { badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30', btn: 'border-violet-500/40 text-violet-300 hover:bg-violet-500/20' },
  red:    { badge: 'bg-red-500/20 text-red-300 border-red-500/30',        btn: 'border-red-500/40 text-red-300 hover:bg-red-500/20'       },
};

const FORMAT_ROWS = [
  { key: 'poolStageFormat',                label: 'Poules principales'         },
  { key: 'knockoutFormat.qf',              label: 'Bracket — Quarts de finale' },
  { key: 'knockoutFormat.sf',              label: 'Bracket — Demi-finales'     },
  { key: 'knockoutFormat.final',           label: 'Bracket — Finale'           },
  { key: 'consolantePoolFormat',           label: 'Consolante — Poules'        },
  { key: 'consolanteKnockoutFormat.final', label: 'Consolante — Finale'        },
];

const DEFAULT_FORMAT = { target: 6, maxSets: 2, tiebreakatDeuce: true };

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Extrait une valeur de format depuis le document tournament (gère les clés imbriquées)
function extractFormat(tournament, key) {
  if (!tournament) return { ...DEFAULT_FORMAT };
  const parts = key.split('.');
  let val = tournament;
  for (const p of parts) val = val?.[p];
  if (!val) return { ...DEFAULT_FORMAT };
  return {
    target:          val.target          ?? DEFAULT_FORMAT.target,
    maxSets:         val.maxSets         ?? DEFAULT_FORMAT.maxSets,
    tiebreakatDeuce: val.tiebreakatDeuce ?? DEFAULT_FORMAT.tiebreakatDeuce,
  };
}

// Reconstruit l'objet imbriqué pour PUT /api/tournament
function buildFormatsBody(formats) {
  return {
    poolStageFormat: formats['poolStageFormat'],
    knockoutFormat: {
      qf:    formats['knockoutFormat.qf'],
      sf:    formats['knockoutFormat.sf'],
      final: formats['knockoutFormat.final'],
    },
    consolantePoolFormat: formats['consolantePoolFormat'],
    consolanteKnockoutFormat: {
      final: formats['consolanteKnockoutFormat.final'],
    },
  };
}

// Formate une date ISO pour input[type=date] (YYYY-MM-DD)
function toDateInput(isoDate) {
  if (!isoDate) return '';
  return new Date(isoDate).toISOString().split('T')[0];
}

// ─── Sous-composant : ligne de format de set ──────────────────────────────────

function FormatRow({ label, value, onChange }) {
  const cycle = (field, options) => {
    const idx = options.indexOf(value[field]);
    onChange(field, options[(idx + 1) % options.length]);
  };

  const ToggleBtn = ({ field, options, display }) => (
    <button
      onClick={() => cycle(field, options)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm transition-colors"
    >
      <span className="text-white/40 text-xs">
        {field === 'target' ? 'Cible' : field === 'maxSets' ? 'Sets' : 'Égalité'}
      </span>
      <span className="text-white font-semibold">{display(value[field])}</span>
    </button>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-white/5 last:border-0">
      <span className="text-white/70 text-sm min-w-[12rem]">{label}</span>
      <div className="flex gap-2">
        <ToggleBtn field="target"          options={[4, 6]}        display={v => `${v} jeux`}         />
        <ToggleBtn field="maxSets"         options={[1, 2, 3]}     display={v => `Best of ${v * 2 - 1}`} />
        <ToggleBtn field="tiebreakatDeuce" options={[true, false]}  display={v => v ? 'Tie-break' : 'Continue'} />
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AdminTournamentPage() {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading]       = useState(true);

  // Section 1 — Infos générales
  const [infos, setInfos]           = useState({ name: '', date: '', location: '', maxTeams: 100 });
  const [infosSaving, setInfosSaving] = useState(false);

  // Section 2 — Formats de set
  const [formats, setFormats]         = useState(() =>
    Object.fromEntries(FORMAT_ROWS.map(r => [r.key, { ...DEFAULT_FORMAT }]))
  );
  const [formatsSaving, setFormatsSaving] = useState(false);

  // Section 3 — Statut
  const [statusLoading, setStatusLoading] = useState(false);

  // Section 5 — Clé API
  const [apiKey, setApiKey]         = useState({ masked: null, full: null, revealed: false });
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [copied, setCopied]         = useState(false);

  // Toast global
  const [toast, setToast]           = useState(null);

  // Modal de confirmation
  const [modal, setModal]           = useState({ open: false });
  const [modalLoading, setModalLoading] = useState(false);

  // ── Chargement initial ────────────────────────────────────────────────────

  const loadTournament = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/tournament');
      const t   = res.data;
      setTournament(t);
      setInfos({
        name:     t.name     || '',
        date:     toDateInput(t.date),
        location: t.location || '',
        maxTeams: t.maxTeams || 100,
      });
      setFormats(Object.fromEntries(FORMAT_ROWS.map(r => [r.key, extractFormat(t, r.key)])));
    } catch {
      showToast('error', 'Impossible de charger la configuration du tournoi');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadApiKey = useCallback(async () => {
    try {
      const res = await api.get('/tournament/apikey');
      setApiKey({ masked: res.data.masked, full: null, revealed: false });
    } catch {
      // Silencieux — clé peut ne pas encore exister
    }
  }, []);

  useEffect(() => {
    loadTournament();
    loadApiKey();
  }, [loadTournament, loadApiKey]);

  // ── Toast helper ──────────────────────────────────────────────────────────

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Section 1 — Enregistrer les infos générales ───────────────────────────

  const saveInfos = async () => {
    try {
      setInfosSaving(true);
      const body = {
        name:     infos.name.trim(),
        maxTeams: Number(infos.maxTeams),
        location: infos.location.trim(),
        ...(infos.date ? { date: infos.date } : {}),
      };
      const res = await api.put('/tournament', body);
      setTournament(res.data);
      showToast('ok', 'Informations enregistrées');
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setInfosSaving(false);
    }
  };

  // ── Section 2 — Enregistrer les formats de set ───────────────────────────

  const saveFormats = async () => {
    try {
      setFormatsSaving(true);
      const res = await api.put('/tournament', buildFormatsBody(formats));
      setTournament(res.data);
      showToast('ok', 'Formats de set enregistrés');
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setFormatsSaving(false);
    }
  };

  const updateFormat = (key, field, value) => {
    setFormats(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  // ── Section 3 — Changer le statut ─────────────────────────────────────────

  const changeStatus = async (newStatus) => {
    try {
      setStatusLoading(true);
      const res = await api.put('/tournament/status', { status: newStatus });
      setTournament(res.data.tournament);
      if (res.data.warning) showToast('warn', res.data.warning);
      else showToast('ok', `Statut mis à jour : ${STATUS_META[newStatus].label}`);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Erreur lors du changement de statut');
    } finally {
      setStatusLoading(false);
    }
  };

  const isRegression = (target) =>
    STATUS_ORDER.indexOf(target) < STATUS_ORDER.indexOf(tournament?.status);

  // ── Section 4 — Resets ────────────────────────────────────────────────────

  const openResetModal = (type) => {
    const configs = {
      pools: {
        title:   'Réinitialiser les poules ?',
        message: 'Tous les groupes et matchs de poule seront supprimés. Les équipes restent inscrites mais leur groupe est remis à zéro.',
      },
      bracket: {
        title:   'Réinitialiser le bracket ?',
        message: 'Tous les matchs knockout (principal + consolante) seront supprimés. Les poules et le tirage restent intacts.',
      },
      all: {
        title:   'Réinitialisation complète ?',
        message: 'Tous les groupes et tous les matchs seront supprimés. Les équipes restent en base, prêtes pour un nouveau tirage. Action irréversible.',
      },
    };
    const cfg = configs[type];
    setModal({ open: true, title: cfg.title, message: cfg.message, danger: true, onConfirm: () => executeReset(type) });
  };

  const executeReset = async (type) => {
    try {
      setModalLoading(true);
      const res = await api.post(`/tournament/reset/${type}`, { confirm: true });
      setModal({ open: false });
      showToast('ok', res.data.message);
    } catch (err) {
      setModal({ open: false });
      showToast('error', err.response?.data?.error || 'Erreur lors du reset');
    } finally {
      setModalLoading(false);
    }
  };

  // ── Section 5 — Clé API ───────────────────────────────────────────────────

  const revealApiKey = async () => {
    if (apiKey.revealed) {
      setApiKey(prev => ({ ...prev, revealed: false, full: null }));
      return;
    }
    try {
      setApiKeyLoading(true);
      const res = await api.get('/tournament/apikey', { params: { reveal: 'true' } });
      setApiKey({ masked: res.data.masked, full: res.data.full, revealed: true });
    } catch {
      showToast('error', 'Impossible de récupérer la clé');
    } finally {
      setApiKeyLoading(false);
    }
  };

  const copyApiKey = async () => {
    const toCopy = apiKey.full;
    if (!toCopy) return;
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('error', 'Impossible de copier dans le presse-papier');
    }
  };

  const openRegenModal = () => {
    setModal({
      open:    true,
      title:   'Régénérer la clé API ?',
      message: "Tous les scripts utilisant l'ancienne clé devront être mis à jour. L'ancienne clé sera immédiatement invalidée.",
      danger:  true,
      onConfirm: executeRegen,
    });
  };

  const executeRegen = async () => {
    try {
      setModalLoading(true);
      const res = await api.post('/tournament/apikey/regenerate', { confirm: true });
      setModal({ open: false });
      setApiKey({ masked: res.data.masked, full: res.data.full, revealed: true });
      showToast('ok', 'Nouvelle clé générée — copiez-la maintenant');
    } catch (err) {
      setModal({ open: false });
      showToast('error', err.response?.data?.error || 'Erreur lors de la régénération');
    } finally {
      setModalLoading(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-white/40">
        Chargement...
      </div>
    );
  }

  const currentStatus = tournament?.status || 'setup';
  const currentMeta   = STATUS_META[currentStatus];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border ${
          toast.type === 'ok'   ? 'bg-green-900/80 text-green-200 border-green-500/30' :
          toast.type === 'warn' ? 'bg-yellow-900/80 text-yellow-200 border-yellow-500/30' :
                                  'bg-red-900/80 text-red-200 border-red-500/30'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <ConfirmModal
          title={modal.title}
          message={modal.message}
          danger={modal.danger}
          loading={modalLoading}
          onConfirm={modal.onConfirm}
          onCancel={() => setModal({ open: false })}
        />
      )}

      {/* En-tête */}
      <div>
        <h1 className="font-display font-bold text-2xl text-white">Configuration du tournoi</h1>
        <p className="text-white/40 text-sm mt-1">Paramètres globaux, formats, statut et gestion des données.</p>
      </div>

      {/* ── Section 1 : Infos générales ──────────────────────────────────── */}
      <section className="bg-dark-800 border border-white/10 rounded-2xl p-6 space-y-4">
        <h2 className="font-display font-semibold text-lg text-white">Informations générales</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-white/50 text-xs mb-1.5">Nom du tournoi</label>
            <input
              type="text"
              value={infos.name}
              onChange={e => setInfos(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
              placeholder="Paris Yaar Club Padel 2026"
            />
          </div>
          <div>
            <label className="block text-white/50 text-xs mb-1.5">Lieu</label>
            <input
              type="text"
              value={infos.location}
              onChange={e => setInfos(p => ({ ...p, location: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
              placeholder="Paris Yaar Club, Paris"
            />
          </div>
          <div>
            <label className="block text-white/50 text-xs mb-1.5">Date</label>
            <input
              type="date"
              value={infos.date}
              onChange={e => setInfos(p => ({ ...p, date: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
            />
          </div>
          <div>
            <label className="block text-white/50 text-xs mb-1.5">Équipes max</label>
            <input
              type="number"
              value={infos.maxTeams}
              min={1}
              onChange={e => setInfos(p => ({ ...p, maxTeams: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500/50"
            />
          </div>
        </div>

        <button
          onClick={saveInfos}
          disabled={infosSaving}
          className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-lg text-white text-sm font-semibold transition-colors"
        >
          {infosSaving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </section>

      {/* ── Section 2 : Formats de set ───────────────────────────────────── */}
      <section className="bg-dark-800 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg text-white">Formats de set</h2>
          <p className="text-white/30 text-xs">Cliquer pour faire défiler les valeurs</p>
        </div>

        {FORMAT_ROWS.map(row => (
          <FormatRow
            key={row.key}
            label={row.label}
            value={formats[row.key]}
            onChange={(field, value) => updateFormat(row.key, field, value)}
          />
        ))}

        <button
          onClick={saveFormats}
          disabled={formatsSaving}
          className="mt-5 px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-lg text-white text-sm font-semibold transition-colors"
        >
          {formatsSaving ? 'Enregistrement...' : 'Enregistrer les formats'}
        </button>
      </section>

      {/* ── Section 3 : Statut ───────────────────────────────────────────── */}
      <section className="bg-dark-800 border border-white/10 rounded-2xl p-6">
        <h2 className="font-display font-semibold text-lg text-white mb-4">Statut du tournoi</h2>

        <div className="flex items-center gap-3 mb-5">
          <span className="text-white/50 text-sm">Statut actuel :</span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[currentMeta.color].badge}`}>
            {currentMeta.label}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {STATUS_ORDER.map(s => {
            const meta      = STATUS_META[s];
            const isCurrent = s === currentStatus;
            const isBack    = isRegression(s);
            return (
              <button
                key={s}
                onClick={() => !isCurrent && !statusLoading && changeStatus(s)}
                disabled={isCurrent || statusLoading}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  isCurrent
                    ? `${STATUS_COLORS[meta.color].badge} cursor-default`
                    : `bg-transparent ${STATUS_COLORS[meta.color].btn} disabled:opacity-40 cursor-pointer`
                }`}
              >
                <span>{meta.label}</span>
                {isBack && !isCurrent && (
                  <span className="block text-[10px] opacity-50">↩ retour arrière</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Section 4 : Zone dangereuse ─────────────────────────────────── */}
      <section className="bg-dark-800 border border-red-500/20 rounded-2xl p-6">
        <h2 className="font-display font-semibold text-lg text-red-400 mb-1">Zone dangereuse</h2>
        <p className="text-white/40 text-sm mb-5">
          Ces actions sont irréversibles. Les équipes inscrites sont toujours conservées.
        </p>

        <div className="space-y-1">
          {[
            {
              type:    'pools',
              title:   'Réinitialiser les poules',
              desc:    'Supprime les groupes et les matchs de poule. Remet le tirage à zéro.',
              btnLabel:'Reset poules',
            },
            {
              type:    'bracket',
              title:   'Réinitialiser le bracket',
              desc:    'Supprime tous les matchs knockout. Les poules restent intactes.',
              btnLabel:'Reset bracket',
            },
            {
              type:    'all',
              title:   'Réinitialisation complète',
              desc:    'Supprime tous les groupes et tous les matchs. Repart à zéro.',
              btnLabel:'Reset complet',
              bold:    true,
            },
          ].map(({ type, title, desc, btnLabel, bold }) => (
            <div key={type} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
              <div>
                <p className="text-white text-sm font-medium">{title}</p>
                <p className="text-white/40 text-xs mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => openResetModal(type)}
                className={`ml-4 shrink-0 px-4 py-2 rounded-lg border transition-colors text-sm ${
                  bold
                    ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/40 text-red-300 font-bold'
                    : 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400 font-medium'
                }`}
              >
                {btnLabel}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 5 : Clé API publique ────────────────────────────────── */}
      <section className="bg-dark-800 border border-white/10 rounded-2xl p-6">
        <h2 className="font-display font-semibold text-lg text-white mb-1">Clé API publique</h2>
        <p className="text-white/40 text-sm mb-5">
          Requise dans le header{' '}
          <code className="text-primary-400 bg-primary-500/10 px-1 rounded text-xs">x-api-key</code>{' '}
          pour accéder aux routes publiques (vue joueur, QR code, scripts externes).
        </p>

        {apiKey.masked === null ? (
          <p className="text-white/40 text-sm italic mb-4">
            Aucune clé en base.{' '}
            <code className="text-white/60 bg-white/5 px-1 rounded text-xs">process.env.API_KEY</code>{' '}
            actif comme fallback si défini sur Render.
          </p>
        ) : (
          <div className="flex items-center gap-3 bg-black/30 border border-white/10 rounded-xl px-4 py-3 mb-4">
            <code className="flex-1 text-sm font-mono text-white/70 overflow-x-auto whitespace-nowrap">
              {apiKey.revealed && apiKey.full ? apiKey.full : apiKey.masked}
            </code>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={revealApiKey}
                disabled={apiKeyLoading}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs transition-colors disabled:opacity-50"
              >
                {apiKeyLoading ? '...' : apiKey.revealed ? 'Masquer' : 'Révéler'}
              </button>
              {apiKey.revealed && apiKey.full && (
                <button
                  onClick={copyApiKey}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs transition-colors"
                >
                  {copied ? 'Copié ✓' : 'Copier'}
                </button>
              )}
            </div>
          </div>
        )}

        <button
          onClick={openRegenModal}
          className="px-4 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-medium transition-colors"
        >
          Régénérer la clé
        </button>
      </section>

    </div>
  );
}
