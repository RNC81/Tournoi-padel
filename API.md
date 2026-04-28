# API Publique — Tournoi Paris Yaar Club

Documentation des endpoints `/api/public/*` destinés à la vue joueur et aux intégrations tierces.

---

## Authentification

Deux niveaux d'accès :

| Endpoint | Auth requise |
|---|---|
| `GET /api/public/config` | Aucune |
| Tous les autres | Header `x-api-key` |

La clé API est générée depuis le panneau admin (section "Paramètres du tournoi → Clé API").  
Elle doit être envoyée dans chaque requête via le header HTTP :

```
x-api-key: <votre_clé>
```

Réponse si clé manquante ou invalide :
```json
{ "error": "Unauthorized" }
```

**Rate limiting :** 100 requêtes / minute / IP.

---

## Base URL

| Environnement | URL |
|---|---|
| Production | `https://padel-api-dtcf.onrender.com/api/public` |
| Local dev | `http://localhost:3001/api/public` |

---

## Endpoints

### `GET /config`

Infos minimales du tournoi — **sans authentification**.  
Utilisé par la page d'accueil pour afficher le nom et le statut sans exposer la clé API.

**Réponse :**
```json
{
  "name":     "Tournoi Paris Yaar Club 2026",
  "status":   "registration",
  "date":     "2026-05-14T00:00:00.000Z",
  "location": "Paris Yaar Club"
}
```

Valeurs possibles pour `status` :

| Valeur | Signification |
|---|---|
| `"registration"` | Inscriptions ouvertes |
| `"pool"` | Phase de poules en cours |
| `"bracket"` | Phase finale en cours |
| `"done"` | Tournoi terminé |

Si aucun tournoi n'est configuré : `{ "name": null, "status": null }`

---

### `GET /tournament`

Infos complètes du tournoi + nombre d'équipes inscrites.

**Headers :** `x-api-key: <clé>`

**Réponse :**
```json
{
  "name":         "Tournoi Paris Yaar Club 2026",
  "status":       "pool",
  "maxTeams":     80,
  "currentPhase": "pool",
  "teamCount":    41,
  "qualificationRules": {
    "tiebreaker": ["points", "setDiff", "setsWon", "directConfrontation"]
  }
}
```

---

### `GET /teams`

Liste toutes les équipes inscrites, triées par date d'inscription.  
Les champs internes (`notes`, `__v`) sont exclus.

**Headers :** `x-api-key: <clé>`

**Réponse :**
```json
[
  {
    "_id":            "664a1b2c3d4e5f6a7b8c9d0e",
    "name":           "Karim / Rayaan",
    "player1":        "Karim Benali",
    "player2":        "Rayaan Mansour",
    "country":        "Paris",
    "tournamentPath": "main",
    "group":          "664a1b2c3d4e5f6a7b8c9d1f",
    "registeredAt":   "2026-04-01T10:23:00.000Z"
  },
  ...
]
```

`tournamentPath` : `null` (non classé) | `"main"` (qualifié) | `"consolante"` (eliminé en poule)

---

### `GET /groups`

Liste tous les groupes avec standings calculés en temps réel.

**Headers :** `x-api-key: <clé>`

**Query params :**

| Param | Valeur | Description |
|---|---|---|
| `phase` | `pool` | Groupes de la phase principale (défaut si omis : tous) |
| `phase` | `consolante_pool` | Groupes de la consolante |

**Réponse :**
```json
[
  {
    "_id":   "664a1b2c3d4e5f6a7b8c9d1f",
    "name":  "A",
    "phase": "pool",
    "teams": [
      {
        "_id":            "664a...",
        "name":           "Karim / Rayaan",
        "player1":        "Karim Benali",
        "player2":        "Rayaan Mansour",
        "country":        "Paris",
        "tournamentPath": "main"
      }
    ],
    "standings": [
      {
        "teamId":   "664a...",
        "rank":     1,
        "points":   9,
        "played":   3,
        "won":      3,
        "lost":     0,
        "setsWon":  6,
        "setsLost": 1,
        "setDiff":  5,
        "team": {
          "_id":    "664a...",
          "name":   "Karim / Rayaan",
          "player1": "Karim Benali",
          "player2": "Rayaan Mansour",
          "country": "Paris"
        }
      }
    ]
  }
]
```

**Logique de classement :**  
Ordre de départage par défaut : `points` → `setDiff` → `setsWon` → `directConfrontation`  
(`setDiff` = sets gagnés − sets perdus, pas différence de jeux)

---

### `GET /groups/:id`

Détail d'un groupe : équipes + matchs + standings.

**Headers :** `x-api-key: <clé>`

**Params :** `:id` = ObjectId du groupe

**Réponse :**
```json
{
  "_id":   "664a1b2c3d4e5f6a7b8c9d1f",
  "name":  "A",
  "phase": "pool",
  "teams": [ /* même format que /groups */ ],
  "standings": [ /* même format que /groups */ ],
  "matches": [
    {
      "_id":    "664a...",
      "phase":  "pool",
      "played": true,
      "result": "team1",
      "sets": [
        { "score1": 6, "score2": 3 },
        { "score1": 6, "score2": 4 }
      ],
      "team1": {
        "_id":    "664a...",
        "name":   "Karim / Rayaan",
        "player1": "Karim Benali",
        "player2": "Rayaan Mansour"
      },
      "team2": {
        "_id":    "664b...",
        "name":   "Samy / Ilyes",
        "player1": "Samy Hamdaoui",
        "player2": "Ilyes Cherif"
      },
      "winner": {
        "_id":  "664a...",
        "name": "Karim / Rayaan"
      }
    }
  ]
}
```

`result` : `"team1"` | `"team2"` | `"draw"` | `null` (non joué)

**Erreurs :**
- `400` — ID invalide (format non ObjectId)
- `404` — Groupe introuvable

---

### `GET /bracket`

Bracket principal groupé par phase, dans l'ordre chronologique.

**Headers :** `x-api-key: <clé>`

**Phases retournées** (seulement celles qui ont des matchs) :

| Clé | Label |
|---|---|
| `r32` | 32èmes de finale |
| `r16` | 16èmes de finale |
| `qf` | Quarts de finale |
| `sf` | Demi-finales |
| `final` | Finale |

**Réponse :**
```json
{
  "r32": [
    {
      "_id":      "664a...",
      "phase":    "r32",
      "position": 1,
      "played":   true,
      "result":   "team1",
      "sets": [
        { "score1": 6, "score2": 4 },
        { "score1": 7, "score2": 5 }
      ],
      "team1": {
        "_id":     "664a...",
        "name":    "Karim / Rayaan",
        "player1": "Karim Benali",
        "player2": "Rayaan Mansour",
        "country": "Paris"
      },
      "team2": { /* même structure */ },
      "winner": {
        "_id":  "664a...",
        "name": "Karim / Rayaan"
      }
    }
  ],
  "qf": [ /* ... */ ],
  "sf": [ /* ... */ ],
  "final": [ /* ... */ ]
}
```

Les matchs de chaque phase sont triés par `position` (ordre du bracket, 1-based).  
Si une phase n'a aucun match, sa clé est absente de la réponse.

---

### `GET /bracket/consolante`

Bracket consolante, même format que `/bracket`.

**Headers :** `x-api-key: <clé>`

**Phases retournées :**

| Clé | Label |
|---|---|
| `consolante_r32` | 32èmes consolante |
| `consolante_r16` | 16èmes consolante |
| `consolante_qf` | Quarts consolante |
| `consolante_sf` | Demis consolante |
| `consolante_final` | Finale consolante |

**Réponse :** même structure que `/bracket`, avec les clés consolante en remplacement.

---

## Codes d'erreur

| Code | Signification |
|---|---|
| `200` | OK |
| `400` | Paramètre invalide (ID malformé, etc.) |
| `401` | Clé API manquante ou invalide |
| `404` | Ressource introuvable |
| `429` | Trop de requêtes (rate limit 100 req/min) |
| `500` | Erreur serveur |

---

## Exemple complet (fetch JS)

```js
const API_BASE = 'https://padel-api-dtcf.onrender.com/api/public';
const API_KEY  = 'votre_clé_api';

async function getGroups(phase = 'pool') {
  const res = await fetch(`${API_BASE}/groups?phase=${phase}`, {
    headers: { 'x-api-key': API_KEY },
  });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.json();
}

async function getBracket() {
  const res = await fetch(`${API_BASE}/bracket`, {
    headers: { 'x-api-key': API_KEY },
  });
  return res.json();
}
```
