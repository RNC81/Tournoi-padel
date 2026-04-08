import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

// Page d'inscription d'une équipe — accès public
export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    player1: { name: '', email: '', phone: '' },
    player2: { name: '', email: '', phone: '' },
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, subField, value) => {
    if (subField) {
      setForm(f => ({ ...f, [field]: { ...f[field], [subField]: value } }));
    } else {
      setForm(f => ({ ...f, [field]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/teams', form);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎾</div>
          <h2 className="font-display font-bold text-2xl text-primary-400 mb-2">Inscription confirmée !</h2>
          <p className="text-white/60 mb-6">
            Votre équipe <span className="text-white font-semibold">"{form.name}"</span> est bien inscrite.
            Vous recevrez les informations du tournoi par email.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/" className="btn-outline">Retour à l'accueil</Link>
            <button onClick={() => { setSuccess(false); setForm({ name: '', player1: { name: '', email: '', phone: '' }, player2: { name: '', email: '', phone: '' } }); }} className="btn-primary">
              Inscrire une autre équipe
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <Link to="/" className="text-white/40 hover:text-white/70 text-sm mb-8 inline-block transition-colors">
          ← Retour à l'accueil
        </Link>

        <div className="card">
          <div className="text-center mb-8">
            <h1 className="font-display font-black text-3xl text-white mb-2">Inscrire votre équipe</h1>
            <p className="text-white/50 text-sm">Tournoi de padel — Paris Yaar Club</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nom de l'équipe */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Nom de l'équipe *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => handleChange('name', null, e.target.value)}
                placeholder="Ex: Les Smasheurs"
                className="input"
                required
                maxLength={50}
              />
            </div>

            {/* Joueur 1 */}
            <PlayerForm
              title="Joueur 1"
              player={form.player1}
              onChange={(field, val) => handleChange('player1', field, val)}
            />

            {/* Joueur 2 */}
            <PlayerForm
              title="Joueur 2"
              player={form.player2}
              onChange={(field, val) => handleChange('player2', field, val)}
            />

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full text-base py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Inscription en cours...' : 'Confirmer l\'inscription →'}
            </button>

            <p className="text-white/30 text-xs text-center">
              En vous inscrivant, vous acceptez le règlement du tournoi.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// Formulaire pour un joueur
function PlayerForm({ title, player, onChange }) {
  return (
    <div className="bg-dark-700 rounded-xl p-4 space-y-4">
      <h3 className="font-semibold text-primary-400 text-sm uppercase tracking-wider">{title}</h3>

      <div>
        <label className="block text-xs text-white/50 mb-1">Prénom et nom *</label>
        <input
          type="text"
          value={player.name}
          onChange={e => onChange('name', e.target.value)}
          placeholder="Jean Dupont"
          className="input"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1">Email *</label>
        <input
          type="email"
          value={player.email}
          onChange={e => onChange('email', e.target.value)}
          placeholder="jean@email.com"
          className="input"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-white/50 mb-1">Téléphone (optionnel)</label>
        <input
          type="tel"
          value={player.phone}
          onChange={e => onChange('phone', e.target.value)}
          placeholder="06 12 34 56 78"
          className="input"
        />
      </div>
    </div>
  );
}
