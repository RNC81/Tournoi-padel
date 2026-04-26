// Retourne { detail: err.message } uniquement hors production.
// En production, les erreurs internes ne sont jamais exposées au client.
module.exports = function safeError(err) {
  if (process.env.NODE_ENV === 'production') return {};
  return { detail: err.message };
};
