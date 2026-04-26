// Modal de confirmation réutilisable.
// Props : title, message, onConfirm, onCancel, danger (bool), loading (bool)
export default function ConfirmModal({ title, message, onConfirm, onCancel, danger = false, loading = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-dark-800 border border-white/15 rounded-xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-display font-bold text-lg text-white mb-2">{title}</h3>
        {message && <p className="text-white/50 text-sm mb-6 leading-relaxed">{message}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
              danger
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-primary-500 hover:bg-primary-600 text-white'
            }`}
          >
            {loading ? 'En cours...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
