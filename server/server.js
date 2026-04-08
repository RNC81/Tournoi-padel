require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const tournamentRoutes = require('./routes/tournament');
const qrRoutes = require('./routes/qrcode');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/tournament', tournamentRoutes);
app.use('/api/qrcode', qrRoutes);

// Route de santé — utile pour Render et les vérifs rapides
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── CONNEXION MONGODB ────────────────────────────────────────────────────────

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connecté à MongoDB');

    app.listen(PORT, () => {
      console.log(`✓ Serveur démarré sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('✗ Erreur de connexion MongoDB :', err.message);
    process.exit(1);
  }
}

startServer();
