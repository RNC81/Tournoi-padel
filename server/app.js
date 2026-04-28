// app.js — Express app sans démarrage du serveur.
// Importé par server.js (prod) ET par les tests Supertest.
'use strict';

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');

const authRoutes       = require('./routes/auth');
const teamRoutes       = require('./routes/teams');
const tournamentRoutes = require('./routes/tournament');
const groupRoutes      = require('./routes/groups');
const matchRoutes      = require('./routes/matches');
const bracketRoutes    = require('./routes/bracket');
const publicRoutes     = require('./routes/public');
const qrRoutes         = require('./routes/qrcode');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth',       authRoutes);
app.use('/api/teams',      teamRoutes);
app.use('/api/tournament', tournamentRoutes);
app.use('/api/groups',     groupRoutes);
app.use('/api/matches',    matchRoutes);
app.use('/api/bracket',    bracketRoutes);
app.use('/api/public',     publicRoutes);
app.use('/api/qrcode',     qrRoutes);

app.get('/api/health', (req, res) => {
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  console.log('[keep-alive] ping reçu —', new Date().toISOString());
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
