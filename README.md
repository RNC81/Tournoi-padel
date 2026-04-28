# Site Tournoi Padel — Paris Yaar Club

Site web complet de gestion d'un tournoi de padel 2v2 (~75 équipes).  
Déployé sur Render · Repo : https://github.com/RNC81/Tournoi-padel

---

## Architecture générale

```
┌─────────────────────────────────────────────────────────────┐
│                        RENDER                               │
│                                                             │
│  ┌─────────────────┐        ┌──────────────────────────┐   │
│  │  React (Vite)   │        │   Node.js / Express      │   │
│  │  Static Site    │◄──────►│   API REST (port 3001)   │   │
│  │                 │  JWT   │                          │   │
│  │  /admin/*       │        │  /api/auth/*             │   │
│  │  /tournoi       │        │  /api/teams/*            │   │
│  │  /              │        │  /api/groups/*           │   │
│  └─────────────────┘        │  /api/matches/*          │   │
│                             │  /api/bracket/*          │   │
│  ┌─────────────────┐        │  /api/tournament/*       │   │
│  │  Autre app dev  │◄──────►│  /api/public/*  (apiKey) │   │
│  │  (vue joueur)   │ apiKey └──────────┬───────────────┘   │
│  └─────────────────┘                   │                   │
│                                        ▼                   │
│                             ┌──────────────────────────┐   │
│                             │   MongoDB Atlas          │   │
│                             │   (managed DB Render)    │   │
│                             └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Flux de données :**
1. L'admin se connecte via `/admin/login` → JWT stocké en localStorage
2. Le frontend appelle `/api/*` avec `Authorization: Bearer <JWT>`
3. Les scores/groupes/brackets sont écrits en MongoDB
4. L'autre app (vue joueur) lit `/api/public/*` avec une `x-api-key`
5. La vue publique intégrée (`/tournoi`) fait pareil — polling toutes les 30s

---

## Structure des dossiers

```
site-padel/
│
├── client/                    # Frontend React (Vite + Tailwind)
│   └── src/
│       ├── components/
│       │   └── admin/         # ConfirmModal, etc.
│       ├── hooks/             # usePolling, useAuth
│       ├── pages/
│       │   ├── HomePage.jsx          # Landing publique
│       │   ├── GuestHomePage.jsx     # Vue joueur read-only (/tournoi)
│       │   ├── AdminLoginPage.jsx
│       │   ├── AdminDashboardPage.jsx
│       │   ├── AdminTeamsPage.jsx    # Gestion équipes + import CSV
│       │   ├── AdminGroupsPage.jsx   # Tirage + saisie scores poules
│       │   ├── AdminBracketPage.jsx  # Bracket principal + scores
│       │   ├── AdminConsolantePage.jsx
│       │   └── AdminTournamentPage.jsx  # Config + formats de set + reset
│       └── utils/
│           ├── api.js         # Axios instance (routes admin — JWT auto)
│           └── publicApi.js   # Axios instance (routes publiques — apiKey auto)
│
├── server/                    # Backend Node.js / Express
│   ├── app.js                 # Express app (exportée — utilisée par tests)
│   ├── server.js              # Point d'entrée : MongoDB connect + écoute
│   ├── middleware/
│   │   ├── auth.js            # requireAuth, requireAdmin, requireSuperAdmin
│   │   └── validateObjectId.js  # Valide req.params.id avant findById
│   ├── models/                # Schémas Mongoose
│   ├── routes/                # Endpoints REST (voir ci-dessous)
│   ├── utils/                 # Algorithmes métier (voir ci-dessous)
│   └── tests/                 # Jest — unitaires + HTTP (Supertest)
│
├── API.md                     # Documentation complète /api/public/*
├── CHECKLIST_TOURNOI.md       # Checklist opérationnelle jour J
└── CLAUDE.md                  # Instructions de travail pour l'IA
```

---

## Guide de démarrage local

### Prérequis

- **Node.js** ≥ 18 (testé sur v20)
- **MongoDB** : Atlas (URI dans `.env`) ou instance locale
- **npm** (inclus avec Node)

### Variables d'environnement

Créer `server/.env` :

```env
# Connexion MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.net/padel-tournoi

# JWT — chaîne aléatoire longue (min 32 caractères)
JWT_SECRET=remplacez-par-une-vraie-cle-aleatoire-longue

# Clé API fallback pour les routes publiques (si pas de clé en DB)
API_KEY=une-autre-cle-aleatoire

# URL du client React (pour le CORS)
CLIENT_URL=http://localhost:5173

# URL publique du site (pour le QR code)
PUBLIC_URL=http://localhost:5173

# Port (optionnel, défaut 3001)
PORT=3001
```

Créer `client/.env` (ou `client/.env.local`) :

```env
# URL de l'API backend
VITE_API_URL=http://localhost:3001

# Clé API publique (même valeur que API_KEY côté serveur)
VITE_PUBLIC_API_KEY=une-autre-cle-aleatoire
```

> ⚠️ Ces fichiers sont dans `.gitignore` — ne jamais les commiter.

### Lancer le projet

```bash
# Terminal 1 — Backend
cd server
npm install
npm run dev        # nodemon → http://localhost:3001

# Terminal 2 — Frontend
cd client
npm install
npm run dev        # Vite → http://localhost:5173
```

### Lancer les tests

```bash
cd server
npm test           # 171 tests (5 suites)

# Une suite spécifique :
npx jest integration   # algorithmes métier (no DB)
npx jest api           # tests HTTP Supertest (nécessite MONGODB_URI)
npx jest standings     # calcul classements
npx jest bracket       # seeding bracket
npx jest draw          # distribution des équipes
```

> Les tests `api.test.js` créent automatiquement une base `<nom>_test`
> et la suppriment après — aucune donnée de prod n'est touchée.

---

## Description des modules backend

### `routes/`

| Fichier | Rôle |
|---|---|
| `auth.js` | Login admin (JWT), gestion des sous-admins (super_admin uniquement). Rate limit : 5 tentatives/min sur `/login`. |
| `teams.js` | CRUD équipes, import CSV en 2 étapes (parse → confirm), déplacement entre poules. |
| `groups.js` | Tirage au sort (POST /draw), gestion manuelle des poules, régénération. Utilise `utils/draw.js`. |
| `matches.js` | Saisie/correction des scores, calcul automatique du winner, propagation dans le bracket. |
| `bracket.js` | Génération du bracket principal et consolante, qualification depuis les poules, seeding anti-conflit. |
| `tournament.js` | Config du tournoi (singleton), formats de set, statut, clé API, resets (pools/bracket/all). |
| `public.js` | Endpoints lecture seule pour la vue joueur et les apps tierces. Protégés par `x-api-key`. |

### `utils/`

| Fichier | Algorithme |
|---|---|
| `draw.js` | **Tirage au sort** : tri par pays → distribution serpentin → shuffle léger dans chaque groupe. Garantit qu'aucun groupe n'a moins de `floor(n/numG)` équipes. Fonction pure testable sans DB. |
| `standings.js` | **Classement de poule** : itère les matchs joués, cumule points/setsWon/setsLost, trie selon les critères de départage dans l'ordre configuré. Gère la confrontation directe. |
| `seeding.js` | **Seeding bracket** : distribution tier-interleaved dans les 4 quarts, puis correcteur swap pour éliminer les conflits intra-groupe et intra-pays au R1. |
| `safeError.js` | Retourne `{ detail: err.message }` en dev, `{}` en prod. Évite de leaker des infos internes dans les erreurs 500. |

### `models/`

| Modèle | Champs clés |
|---|---|
| `Tournament` | Singleton. `status`, `apiKey`, `qualificationRules.tiebreaker`, formats de set par phase. |
| `Team` | `player1`, `player2`, `country`, `group` (ref Group), `tournamentPath` (`main`/`consolante`/`eliminated`/`null`). |
| `Group` | `phase` (`pool`/`consolante_pool`), `teams[]`, `matches[]`. Standings calculés à la volée, jamais stockés. |
| `Match` | `phase`, `team1`, `team2`, `sets[{score1,score2}]`, `result`, `winner`, `position` (bracket), `setFormat` (copie figée au moment de la création). |
| `User` | `username`, `password` (bcrypt 12 rounds), `role` (`super_admin`/`admin`), `status` (`active`/`suspended`). |

---

## Guide des algorithmes métier

### 1. Tirage au sort (`utils/draw.js`)

**Problème :** distribuer N équipes en groupes en évitant que deux équipes du même pays/ville se retrouvent dans le même groupe.

```
Étape 1 — Calcul du nombre de groupes
  numG = floor(N / groupSize)
  Pour 41 équipes, groupSize 5 : floor(41/5) = 8 groupes
  Le reste (41 - 8×5 = 1 équipe) est réparti dans les 8 groupes existants

Étape 2 — Tri par pays (normalisé toLowerCase)
  [Paris, Paris, Lyon, Lyon, Maroc, Maroc, ...]
  Les équipes du même pays sont adjacentes

Étape 3 — Distribution serpentin
  Cycle 0 (→) : équipes 0..7  → groupes 0,1,2,3,4,5,6,7
  Cycle 1 (←) : équipes 8..15 → groupes 7,6,5,4,3,2,1,0
  Cycle 2 (→) : équipes 16..23 → groupes 0,1,2,...
  Deux équipes adjacentes (même pays) atterrissent dans des groupes différents

Étape 4 — Shuffle léger dans chaque groupe (évite la prédictibilité)
```

**Garantie :** au pire, `ceil(K/numG)` équipes d'un même pays par groupe (K = effectif de ce pays).

---

### 2. Classement de poule (`utils/standings.js`)

```
Pour chaque match joué :
  Compter les sets gagnés par chaque équipe (score1 > score2 → set pour team1)
  Si team1 gagne plus de sets : won++, points += 3 ; team2 : lost++
  result === 'draw' : aucun point (cas forcé manuellement uniquement)

setDiff = setsWon - setsLost
  ⚠️ Différence de SETS (pas de jeux — 6-3 et 6-1 valent la même chose)

Critères de départage (ordre par défaut) :
  1. points              → victoires × 3
  2. setDiff             → sets gagnés − sets perdus
  3. setsWon             → sets gagnés en absolu
  4. directConfrontation → résultat du match entre les deux équipes à égalité
```

---

### 3. Qualification depuis les poules (`routes/bracket.js`)

```
Paramètre : bracketTarget (8 / 16 / 32 / 64)

qualPerGroup  = floor(bracketTarget / nbGroupes)
wildcardSpots = bracketTarget − (qualPerGroup × nbGroupes)
wildcardRank  = qualPerGroup + 1

Exemple : 8 groupes, bracketTarget 32
  qualPerGroup = 4 (4 premiers de chaque groupe → 32 qualifiés)
  wildcardSpots = 0

Exemple : 5 groupes, bracketTarget 32
  qualPerGroup = 6 (30 qualifiés)
  wildcardSpots = 2 (les 2 meilleurs 7e de groupe selon le tiebreaker)

Garantie : exactement bracketTarget qualifiés, 0 BYE si assez d'équipes.
```

---

### 4. Seeding du bracket (`utils/seeding.js`)

```
Objectif : au R1, jamais deux équipes du même groupe ou du même pays

Étape 1 — Tri tier-interleaved
  1er de chaque groupe, puis 2e, puis 3e…
  Les têtes de série (1ers) sont les mieux classées

Étape 2 — Distribution serpentin dans 4 quarts du bracket
  Pattern : Q0, Q1, Q2, Q3, Q3, Q2, Q1, Q0, Q0, Q1...
  Un 1er de groupe ne peut pas rencontrer un autre 1er au R1

Étape 3 — Correcteur swap
  Pour chaque conflit R1 (même groupe ou même pays) :
    Essayer de swapper le slot faible avec un autre dans le même quart
    Si impossible, tenter dans tout le bracket
    Si toujours impossible : conflit reporté dans conflicts[] (non bloquant)
```

---

### 5. Logique consolante

```
team.tournamentPath pilote tout :
  null         → pas encore classée
  'main'       → qualifiée pour le bracket principal
  'consolante' → éliminée en poule → éligible pour la consolante
  'eliminated' → éliminée en consolante → terminé

Règle fondamentale : pas de réintégration.
  Une équipe 'main' qui perd ne rejoint pas la consolante.
  POST /api/groups/draw?phase=consolante_pool sélectionne uniquement
  Team.find({ tournamentPath: 'consolante' }).
```

---

## Guide opérationnel — Jour J

Voir [`CHECKLIST_TOURNOI.md`](./CHECKLIST_TOURNOI.md) pour le détail complet.

### Ordre des actions

```
1. Reset complet  (Admin → Zone Dangereuse → Reset All)
2. Import CSV     équipes finales
3. Config         formats de set dans Admin → Paramètres
4. Vérifier       /api/health et /api/public/config
5. Tirage         groupSize 5 → 8 groupes pour ~41 équipes
6. Poules         saisir scores → standings automatiques
7. Bracket        bracketTarget 32 → générer principal + consolante
8. Finale         saisir scores bracket
9. Export         résultats CSV
```

### Récupérer d'erreurs courantes

**Score saisi par erreur**
Rouvrir le match → modifier → Enregistrer. Le winner est recalculé automatiquement.
Si le winner avait déjà avancé en bracket : modifier aussi le match suivant.

**Site ne répond plus**
Render free tier dort après inactivité — le keep-alive (badge vert sidebar) doit être actif.
En dernier recours : redémarrer depuis le dashboard Render.

**Vue joueur n'affiche pas les données**
Vérifier que `VITE_PUBLIC_API_KEY` dans Render = valeur de `apiKey` en DB.
Admin → Paramètres → Clé API → Révéler.

### Commandes curl d'urgence

```bash
# Health check
curl https://padel-api-dtcf.onrender.com/api/health

# Config publique (sans clé)
curl https://padel-api-dtcf.onrender.com/api/public/config

# Compter les équipes (remplacer TOKEN)
curl https://padel-api-dtcf.onrender.com/api/teams/count \
  -H "Authorization: Bearer TOKEN"

# Lister les groupes (remplacer TOKEN)
curl https://padel-api-dtcf.onrender.com/api/groups \
  -H "Authorization: Bearer TOKEN"
```

---

## Sécurité

- **Auth** : JWT (7 jours), bcrypt 12 rounds
- **Rate limit login** : 5 tentatives/min/IP — brute force bloqué
- **Rate limit public** : 100 req/min/IP
- **CORS** : `CLIENT_URL` uniquement
- **Helmet** : headers HTTP sécurisés (CSP, X-Frame-Options, HSTS…)
- **Validation** : `validateObjectId` sur toutes les routes `/:id`, `maxlength` sur les champs string, `express.json({ limit: '1mb' })`
- **Erreurs** : `safeError` — `err.message` jamais exposé en production

---

## URLs de production

| Service | URL |
|---|---|
| Frontend | https://idpp-r5hj.onrender.com |
| API | https://padel-api-dtcf.onrender.com |
| Admin | https://idpp-r5hj.onrender.com/admin |
| Vue joueur | https://idpp-r5hj.onrender.com/tournoi |
