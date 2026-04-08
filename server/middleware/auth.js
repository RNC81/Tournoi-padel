const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Vérifie que le token JWT est valide — utilisé sur toutes les routes protégées
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant ou invalide' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Récupérer l'utilisateur en base pour vérifier qu'il est toujours actif
    const user = await User.findById(decoded.id).select('-password');
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Compte inactif ou supprimé' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

// Vérifie que l'utilisateur est super_admin — utilisé sur les routes sensibles
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Accès réservé au super administrateur' });
  }
  next();
};

// Vérifie que l'utilisateur est au moins admin (admin ou super_admin)
const requireAdmin = (req, res, next) => {
  if (!['admin', 'super_admin'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
};

module.exports = { requireAuth, requireSuperAdmin, requireAdmin };
