# Session Notes — V1 stable

## Statut : V1 COMPLÈTE ET DÉPLOYÉE EN PRODUCTION
## Dernière mise à jour : 2026-04-28
## Tag : v1.0.0

---

## URLs de production

| Service | URL |
|---|---|
| Frontend | https://idpp-r5hj.onrender.com |
| Backend | https://padel-api-dtcf.onrender.com |
| Admin | https://idpp-r5hj.onrender.com/admin |
| Vue joueur | https://idpp-r5hj.onrender.com/tournoi |
| GitHub | https://github.com/RNC81/Tournoi-padel |

---

## Date du tournoi : 13 mai 2026

Checklist opérationnelle : voir `CHECKLIST_TOURNOI.md`

---

## Ce qui est FAIT (V1 complète)

### Backend
- [x] Auth JWT (super_admin + admins, rate limit login 5/min)
- [x] CRUD équipes + import CSV 2 étapes (parse → confirm)
- [x] Tirage au sort : serpentin par pays, floor(n/groupSize) groupes, jamais < 3 équipes
- [x] Matchs round-robin générés automatiquement par poule
- [x] Saisie/correction scores, winner calculé, propagation bracket
- [x] Classement temps réel (points, setDiff, setsWon, confrontation directe)
- [x] Qualification : qualPerGroup + wildcards = bracketTarget exact
- [x] Seeding bracket : distribution quarts + correcteur swap anti-conflit
- [x] Bracket consolante (équipes tournamentPath='consolante' uniquement)
- [x] Reset pools / bracket / all
- [x] Clé API (DB + fallback env), régénération cryptographique
- [x] Routes publiques /api/public/* (config sans auth, reste avec apiKey)
- [x] Audit sécurité complet : safeError, maxlength, validateObjectId partout

### Frontend admin
- [x] Login admin + Dashboard
- [x] AdminTeamsPage : liste, création, modification, suppression, import CSV
- [x] AdminGroupsPage : tirage, affichage poules, saisie scores (ScoreModal S3 auto-reveal)
- [x] AdminBracketPage : génération, saisie scores bracket principal
- [x] AdminConsolantePage : idem pour la consolante
- [x] AdminTournamentPage : config, formats de set, statut, clé API, zone dangereuse

### Frontend public
- [x] Homepage landing (date, progression équipes, déroulement, règlement)
- [x] GuestHomePage /tournoi : onglets Poules / Bracket / Consolante, polling 30s

### Qualité
- [x] 171 tests (5 suites Jest) — 0 échec
  - standings.test.js, draw.test.js, bracket.test.js : unitaires purs
  - integration.test.js : 5 suites algorithmes métier
  - api.test.js : 40 tests HTTP Supertest
- [x] README.md complet (architecture, algos, guide opérationnel)
- [x] API.md : doc des endpoints /api/public/* pour l'autre équipe dev
- [x] CHECKLIST_TOURNOI.md : checklist jour J chronologique

---

## Compte super admin

- Username : `rayaan`
- Mot de passe : voir variables d'env Render (ne pas noter ici)

---

## Ce qui reste à faire APRÈS le tournoi

### Priorité haute (utile dès J+1)
- [ ] **Export CSV résultats** : bouton admin qui génère équipe / joueurs / poule / classement / bracket atteint
- [ ] **Page résultats finale** : palmarès public (vainqueur, finaliste, vainqueur consolante)
- [ ] **Archivage** : changer statut → `finished`, désactiver keep-alive

### Améliorations futures (V2)
- [ ] **Stats post-tournoi** : meilleur ratio de sets, équipe la plus régulière, etc.
- [ ] **Notifications live** : WebSocket ou SSE pour éviter le polling 30s
- [ ] **Mode multi-tournois** : plusieurs tournois en DB (actuellement singleton)
- [ ] **Inscription publique** : formulaire `/inscription` avec validation et gestion liste d'attente
- [ ] **QR code** : vérifier que `/api/qrcode` retourne bien l'URL /tournoi en prod
- [ ] **Mobile admin** : l'interface admin est utilisable mais pas optimisée pour téléphone
- [ ] **Tests E2E** : Playwright ou Cypress sur les flux critiques (tirage → score → classement)
- [ ] **Logs structurés** : winston ou pino pour avoir des logs en prod (actuellement console.log)

---

## Notes techniques importantes

### Variable d'env à vérifier avant le tournoi
```
Render Backend  → VITE_API_URL, CLIENT_URL, JWT_SECRET, API_KEY, MONGODB_URI
Render Frontend → VITE_API_URL, VITE_PUBLIC_API_KEY
```
`VITE_PUBLIC_API_KEY` doit correspondre à la valeur `apiKey` stockée en DB
(visible dans Admin → Paramètres → Clé API → Révéler).

### Bug connu corrigé en V1
- 41 équipes / groupSize 5 créait autrefois un 9e groupe à 1 équipe
  → Corrigé : `calcNumGroups = floor(41/5) = 8`, reste distribué dans les 8
- Distribution pays était aléatoire
  → Corrigée : serpentin après tri par pays (`utils/draw.js`)
- ScoreModal affichait 3 champs même en BO3
  → Corrigé : S3 révélé automatiquement quand score 1-1

### Sécurité
- Rate limit login : 5/min/IP (`skipSuccessfulRequests: true`)
- `safeError` appliqué partout — jamais de stack trace en prod
- `express.json({ limit: '1mb' })`
- `maxlength` sur tous les champs string critiques
