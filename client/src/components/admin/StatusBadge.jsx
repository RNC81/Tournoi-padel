// Badge de statut du tournoi — couleur et libellé selon la valeur de status.
const STATUS_CONFIG = {
  setup:        { label: 'Configuration',    color: 'bg-white/10 text-white/60'            },
  registration: { label: 'Inscriptions',     color: 'bg-primary-500/20 text-primary-400'   },
  pool_stage:   { label: 'Phase de poules',  color: 'bg-blue-500/20 text-blue-400'         },
  knockout:     { label: 'Bracket principal','color': 'bg-gold-500/20 text-gold-400'       },
  consolante:   { label: 'Consolante',       color: 'bg-purple-500/20 text-purple-400'     },
  finished:     { label: 'Terminé',          color: 'bg-white/5 text-white/40'             },
};

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status ?? '—', color: 'bg-white/10 text-white/50' };
  return (
    <span className={`badge ${cfg.color} text-xs font-semibold`}>
      {cfg.label}
    </span>
  );
}
