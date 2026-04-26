const mongoose = require('mongoose');

// Middleware : vérifie que req.params.id est un ObjectId MongoDB valide.
// Évite les erreurs 500 sur des requêtes findById avec un ID malformé.
module.exports = function validateObjectId(req, res, next) {
  const id = req.params.id;
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'ID invalide' });
  }
  next();
};
