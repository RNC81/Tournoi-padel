const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Générer un token JWT pour un utilisateur
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/login — Connexion admin
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }

    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Ce compte est suspendu' });
    }

    const valid = await user.verifyPassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    }

    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/me — Récupérer son propre profil
router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user._id, username: req.user.username, role: req.user.role });
});

// POST /api/auth/admins — Créer un sous-admin (super_admin uniquement)
router.post('/admins', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mot de passe trop court (minimum 6 caractères)' });
    }

    const existing = await User.findOne({ username: username.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: 'Cet identifiant est déjà pris' });
    }

    const newAdmin = await User.create({
      username: username.toLowerCase().trim(),
      password,
      role: 'admin',
      status: 'active',
      createdBy: req.user._id,
    });

    res.status(201).json({
      id: newAdmin._id,
      username: newAdmin.username,
      role: newAdmin.role,
      status: newAdmin.status,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/admins — Lister tous les admins (super_admin uniquement)
router.get('/admins', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const admins = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/auth/admins/:id/status — Suspendre/réactiver un admin
router.patch('/admins/:id/status', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.role === 'super_admin') {
      return res.status(403).json({ error: 'Impossible de modifier le super admin' });
    }

    user.status = status;
    await user.save();
    res.json({ id: user._id, username: user.username, status: user.status });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/auth/admins/:id — Supprimer un sous-admin
router.delete('/admins/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (user.role === 'super_admin') {
      return res.status(403).json({ error: 'Impossible de supprimer le super admin' });
    }

    await user.deleteOne();
    res.json({ message: 'Admin supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
