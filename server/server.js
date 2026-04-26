require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const mongoose = require('mongoose');

const authRoutes       = require('./routes/auth');
const teamRoutes       = require('./routes/teams');
const tournamentRoutes = require('./routes/tournament');
const groupRoutes      = require('./routes/groups');
const matchRoutes      = require('./routes/matches');
const bracketRoutes    = require('./routes/bracket');
const publicRoutes     = require('./routes/public');
const qrRoutes         = require('./routes/qrcode');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── SÉCURITÉ & MIDDLEWARE ────────────────────────────────────────────────────

// Helmet : headers HTTP sécurisés (XSS, clickjacking, MIME sniffing, etc.)
app.use(helmet());

app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.use('/api/auth',       authRoutes);
app.use('/api/teams',      teamRoutes);
app.use('/api/tournament', tournamentRoutes);
app.use('/api/groups',     groupRoutes);
app.use('/api/matches',    matchRoutes);
app.use('/api/bracket',    bracketRoutes);
app.use('/api/public',     publicRoutes);
app.use('/api/qrcode',     qrRoutes);

// Route de santé — Render + keep-alive frontend
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
