// api.test.js — Tests HTTP (Supertest) avec base MongoDB de test isolée.
//
// Stratégie DB : MONGODB_URI du .env, mais DB renommée en "<nom>_test".
// → Jamais de collision avec les données de prod.
// → Nettoyage complet après chaque test.
//
// Prérequis : MONGODB_URI dans server/.env (ou variable d'environnement).
// Si absente, tous les tests sont skippés avec un message clair.
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const request  = require('supertest');
const app      = require('../app');

const User       = require('../models/User');
const Tournament = require('../models/Tournament');
const Team       = require('../models/Team');
const Group      = require('../models/Group');
const Match      = require('../models/Match');

// ─── Connexion à une base _test isolée ────────────────────────────────────────

// Remplace le nom de la DB dans l'URI par <nom>_test
function buildTestUri(uri) {
  if (!uri) return null;
  // Atlas URI : mongodb+srv://user:pass@cluster.net/dbname?options
  // Local URI  : mongodb://localhost:27017/dbname
  return uri.replace(/\/([^/?]+)(\?|$)/, '/$1_test$2');
}

const RAW_URI    = process.env.MONGODB_URI;
const TEST_URI   = buildTestUri(RAW_URI);
const SKIP_TESTS = !TEST_URI;

if (SKIP_TESTS) {
  // eslint-disable-next-line no-console
  console.warn('\n⚠ MONGODB_URI manquant — tests API skippés. Renseigner server/.env.\n');
}

// Conditions pour les tests qui nécessitent une DB réelle
const itDB   = SKIP_TESTS ? it.skip : it;
const testDB = SKIP_TESTS ? test.skip : test;

const TEST_API_KEY = 'test-api-key-12345';

beforeAll(async () => {
  if (SKIP_TESTS) return;
  process.env.JWT_SECRET = 'test-jwt-secret-local';
  process.env.API_KEY    = TEST_API_KEY;
  await mongoose.connect(TEST_URI);
}, 15_000);

afterAll(async () => {
  if (SKIP_TESTS || mongoose.connection.readyState === 0) return;
  // Supprimer toute la base de test
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  if (SKIP_TESTS || mongoose.connection.readyState === 0) return;
  await Promise.all([
    User.deleteMany({}),
    Tournament.deleteMany({}),
    Team.deleteMany({}),
    Group.deleteMany({}),
    Match.deleteMany({}),
  ]);
});

// ─── Helpers fixtures ─────────────────────────────────────────────────────────

async function createAdminUser() {
  return User.create({
    username: 'testadmin',
    password: 'password123',
    role:     'super_admin',
    status:   'active',
  });
}

async function loginAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'testadmin', password: 'password123' });
  return res.body.token;
}

async function createTournament(overrides = {}) {
  return Tournament.create({
    name:   'Tournoi Test',
    status: 'registration',
    apiKey: TEST_API_KEY,
    qualificationRules: { tiebreaker: ['points', 'setDiff', 'setsWon'] },
    ...overrides,
  });
}

async function createTeams(n, options = {}) {
  const teams = Array.from({ length: n }, (_, i) => ({
    name:    `Team ${i}`,
    player1: `Joueur ${i}A`,
    player2: `Joueur ${i}B`,
    country: options.country || `Pays${i % 3}`,
  }));
  return Team.insertMany(teams);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE DE SANTÉ (pas de DB requise)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/health', () => {
  test('200 sans auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH — POST /api/auth/login
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    if (SKIP_TESTS) return;
    await createAdminUser();
  });

  testDB('200 + JWT avec identifiants corrects', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'password123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.username).toBe('testadmin');
    expect(res.body.user.role).toBe('super_admin');
    // Le hash du mot de passe ne doit jamais être retourné
    expect(res.body.user.password).toBeUndefined();
  });

  testDB('401 avec mauvais mot de passe', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'mauvais' });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  testDB('401 avec utilisateur inexistant', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'fantome', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  testDB('400 si body incomplet (sans password)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin' });

    expect(res.status).toBe(400);
  });

  testDB('403 si utilisateur suspendu', async () => {
    await User.findOneAndUpdate({ username: 'testadmin' }, { status: 'suspended' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testadmin', password: 'password123' });

    expect(res.status).toBe(403);
  });

  testDB('GET /api/auth/me → 200 avec token valide', async () => {
    const token = await loginAdmin();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testadmin');
  });

  testDB('GET /api/auth/me → 401 sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  testDB('GET /api/auth/me → 401 avec token forgé', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer faux.token.jwt');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC — GET /api/public/config
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/public/config', () => {
  testDB('200 sans clé API (endpoint non protégé)', async () => {
    await createTournament({ name: 'Tournoi PYC', status: 'registration' });

    const res = await request(app).get('/api/public/config');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Tournoi PYC');
    expect(res.body.status).toBe('registration');
    // Les champs sensibles ne doivent pas apparaître
    expect(res.body.apiKey).toBeUndefined();
    expect(res.body.password).toBeUndefined();
  });

  testDB('200 avec null si aucun tournoi configuré', async () => {
    const res = await request(app).get('/api/public/config');

    expect(res.status).toBe(200);
    expect(res.body.name).toBeNull();
  });

  testDB('retourne date et location si renseignés', async () => {
    await createTournament({
      date:     new Date('2026-05-14'),
      location: 'Paris Yaar Club',
    });

    const res = await request(app).get('/api/public/config');

    expect(res.body.location).toBe('Paris Yaar Club');
    expect(res.body.date).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC — GET /api/public/groups
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /api/public/groups', () => {
  testDB('401 sans clé API', async () => {
    const res = await request(app).get('/api/public/groups');
    expect(res.status).toBe(401);
  });

  testDB('401 avec mauvaise clé API', async () => {
    const res = await request(app)
      .get('/api/public/groups')
      .set('x-api-key', 'mauvaise-cle');
    expect(res.status).toBe(401);
  });

  testDB('200 avec bonne clé — tableau vide si pas de groupes', async () => {
    await createTournament();

    const res = await request(app)
      .get('/api/public/groups')
      .set('x-api-key', TEST_API_KEY);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  testDB('200 — retourne groupes avec standings calculés', async () => {
    const tournament = await createTournament();
    const teams = await createTeams(4);

    await Group.create({
      name:       'A',
      tournament: tournament._id,
      phase:      'pool',
      teams:      teams.map(t => t._id),
      matches:    [],
    });

    const res = await request(app)
      .get('/api/public/groups?phase=pool')
      .set('x-api-key', TEST_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('A');
    expect(Array.isArray(res.body[0].standings)).toBe(true);
    expect(res.body[0].standings.length).toBe(4);
  });

  testDB('clé API stockée en DB prime sur la variable env', async () => {
    const customKey = 'custom-db-key-xyz';
    await createTournament({ apiKey: customKey });

    // La clé env ne fonctionne plus quand une clé DB est définie
    const resEnv = await request(app)
      .get('/api/public/groups')
      .set('x-api-key', TEST_API_KEY);
    expect(resEnv.status).toBe(401);

    // La clé DB fonctionne
    const resDb = await request(app)
      .get('/api/public/groups')
      .set('x-api-key', customKey);
    expect(resDb.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEAMS — POST /api/teams
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/teams', () => {
  let token;

  beforeEach(async () => {
    if (SKIP_TESTS) return;
    await createAdminUser();
    token = await loginAdmin();
  });

  testDB('201 avec body complet', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ player1: 'Alice Dupont', player2: 'Bob Martin', country: 'Paris' });

    expect(res.status).toBe(201);
    expect(res.body._id).toBeDefined();
    expect(res.body.player1).toBe('Alice Dupont');
    expect(res.body.country).toBe('Paris');
  });

  testDB('auto-génère le nom si absent (Prénom1 / Prénom2)', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ player1: 'Alice Dupont', player2: 'Bob Martin', country: 'Paris' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Alice / Bob');
  });

  testDB('accepte un nom explicite', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Les Legends', player1: 'Alice Dupont', player2: 'Bob Martin' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Les Legends');
  });

  testDB('400 si player1 manquant', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ player2: 'Bob Martin', country: 'Paris' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/player1/i);
  });

  testDB('400 si player2 manquant', async () => {
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ player1: 'Alice Dupont', country: 'Paris' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/player2/i);
  });

  testDB('country est optionnel — chaîne vide si absent', async () => {
    // Note : seuls player1/player2 sont requis, country est facultatif
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ player1: 'Alice Dupont', player2: 'Bob Martin' });

    expect(res.status).toBe(201);
    expect(res.body.country).toBe('');
  });

  testDB('401 sans token', async () => {
    const res = await request(app)
      .post('/api/teams')
      .send({ player1: 'Alice', player2: 'Bob', country: 'Paris' });

    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPS — POST /api/groups/draw
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/groups/draw', () => {
  let token;

  beforeEach(async () => {
    if (SKIP_TESTS) return;
    await createAdminUser();
    token = await loginAdmin();
    await createTournament();
  });

  testDB('201 — crée les groupes et matchs round-robin', async () => {
    await createTeams(20); // 20 équipes → floor(20/4) = 5 groupes de 4

    const res = await request(app)
      .post('/api/groups/draw')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'pool', groupSize: 4 });

    expect(res.status).toBe(201);
    expect(res.body.groups.length).toBe(5);
    // 5 groupes × C(4,2) = 5 × 6 = 30 matchs
    const totalMatches = res.body.groups.reduce((s, g) => s + g.matchCount, 0);
    expect(totalMatches).toBe(30);
  });

  testDB('aucun groupe ne contient moins de floor(n/numG) équipes (cas 41 équipes)', async () => {
    await createTeams(41); // cas critique : floor(41/5) = 8 groupes, reste 1

    const res = await request(app)
      .post('/api/groups/draw')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'pool', groupSize: 5 });

    expect(res.status).toBe(201);
    expect(res.body.groups.length).toBe(8);

    const groups = await Group.find({}).populate('teams');
    for (const g of groups) {
      expect(g.teams.length).toBeGreaterThanOrEqual(5);
    }
  });

  testDB('409 si des groupes existent déjà pour cette phase', async () => {
    await createTeams(12);
    await request(app)
      .post('/api/groups/draw')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'pool', groupSize: 4 });

    const res = await request(app)
      .post('/api/groups/draw')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'pool', groupSize: 4 });

    expect(res.status).toBe(409);
  });

  testDB('400 si pas assez d\'équipes éligibles (< 4)', async () => {
    await createTeams(3);

    const res = await request(app)
      .post('/api/groups/draw')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'pool', groupSize: 4 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/minimum 4/i);
  });

  testDB('total équipes distribuées = total équipes en DB', async () => {
    await createTeams(25);

    await request(app)
      .post('/api/groups/draw')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'pool', groupSize: 5 });

    const groups = await Group.find({}).populate('teams');
    const total  = groups.reduce((s, g) => s + g.teams.length, 0);
    expect(total).toBe(25);
  });

  testDB('team.group est renseigné pour toutes les équipes après tirage', async () => {
    await createTeams(8);

    await request(app)
      .post('/api/groups/draw')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'pool', groupSize: 4 });

    const teams = await Team.find({});
    for (const t of teams) {
      expect(t.group).not.toBeNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MATCHES — PUT /api/matches/:id/score
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /api/matches/:id/score', () => {
  let token, match, team1, team2;

  beforeEach(async () => {
    if (SKIP_TESTS) return;
    await createAdminUser();
    token = await loginAdmin();
    const tournament = await createTournament();
    [team1, team2]   = await createTeams(2);

    match = await Match.create({
      tournament: tournament._id,
      phase:      'pool',
      team1:      team1._id,
      team2:      team2._id,
      setFormat:  { maxSets: 2 },
    });
  });

  testDB('200 — winner = team1 si team1 gagne 2-0', async () => {
    const res = await request(app)
      .put(`/api/matches/${match._id}/score`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sets: [{ score1: 6, score2: 3 }, { score1: 6, score2: 4 }] });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('team1');
    expect(res.body.played).toBe(true);
    expect(String(res.body.winner._id)).toBe(String(team1._id));
  });

  testDB('200 — winner = team2 si team2 gagne 2-0', async () => {
    const res = await request(app)
      .put(`/api/matches/${match._id}/score`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sets: [{ score1: 3, score2: 6 }, { score1: 4, score2: 6 }] });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('team2');
    expect(String(res.body.winner._id)).toBe(String(team2._id));
  });

  testDB('200 — winner = team1 en Best of 3 (2-1 après S3)', async () => {
    const res = await request(app)
      .put(`/api/matches/${match._id}/score`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sets: [
          { score1: 6, score2: 3 },
          { score1: 3, score2: 6 },
          { score1: 7, score2: 5 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('team1');
    expect(String(res.body.winner._id)).toBe(String(team1._id));
  });

  testDB('400 si sets vide', async () => {
    const res = await request(app)
      .put(`/api/matches/${match._id}/score`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sets: [] });

    expect(res.status).toBe(400);
  });

  testDB('400 si égalité de sets sans result: "draw" explicite (1-1 sans S3)', async () => {
    const res = await request(app)
      .put(`/api/matches/${match._id}/score`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        sets: [{ score1: 6, score2: 3 }, { score1: 3, score2: 6 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/égalité/i);
  });

  testDB('200 avec result: "draw" explicite → winner null', async () => {
    const res = await request(app)
      .put(`/api/matches/${match._id}/score`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sets: [{ score1: 6, score2: 6 }], result: 'draw' });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('draw');
    expect(res.body.winner).toBeNull();
  });

  testDB('400 si score négatif', async () => {
    const res = await request(app)
      .put(`/api/matches/${match._id}/score`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sets: [{ score1: -1, score2: 6 }] });

    expect(res.status).toBe(400);
  });

  testDB('score corrigeable — second appel écrase le premier', async () => {
    await request(app)
      .put(`/api/matches/${match._id}/score`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sets: [{ score1: 6, score2: 3 }, { score1: 6, score2: 4 }] });

    const res = await request(app)
      .put(`/api/matches/${match._id}/score`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sets: [{ score1: 3, score2: 6 }, { score1: 4, score2: 6 }] });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('team2');
  });

  testDB('404 si match inexistant', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res    = await request(app)
      .put(`/api/matches/${fakeId}/score`)
      .set('Authorization', `Bearer ${token}`)
      .send({ sets: [{ score1: 6, score2: 3 }] });

    expect(res.status).toBe(404);
  });

  testDB('401 sans token', async () => {
    const res = await request(app)
      .put(`/api/matches/${match._id}/score`)
      .send({ sets: [{ score1: 6, score2: 3 }, { score1: 6, score2: 4 }] });

    expect(res.status).toBe(401);
  });
});
