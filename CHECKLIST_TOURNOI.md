# Checklist Tournoi — Paris Yaar Club · 14 & 16 Mai 2026

> À faire dans l'ordre. Cocher chaque étape avant de passer à la suivante.

---

## J-1 (13 mai) — Préparation

### Reset & import

- [ ] Se connecter à `/admin/login` en prod
- [ ] Aller dans "Paramètres du tournoi" → Section "Zone Dangereuse"
- [ ] **POST /api/tournament/reset/all** (bouton "Reset complet")
      → Confirmer : supprime groupes, matchs, remet team.group à null
      → **Les équipes de test restent** — les supprimer manuellement si besoin
- [ ] Vérifier que la liste des équipes est vide (ou ne contient que les vraies)
- [ ] Importer le CSV final des équipes via "Importer CSV"
      → Vérifier le mapping des colonnes (player1, player2, country)
      → Confirmer l'import
- [ ] Vérifier le nombre d'équipes importées (`/api/public/config` → teamCount)
- [ ] Vérifier quelques équipes au hasard : noms corrects, pays rempli

### Configuration

- [ ] Dans "Paramètres du tournoi" → renseigner Date et Lieu si pas déjà fait
- [ ] Vérifier les formats de set :
      - Phase de poules : Best of 3 (maxSets = 2), tiebreak à 7 pts
      - Phase finale : Best of 3 ou Best of 5 selon décision
      - Consolante : idem poules ou final ?
- [ ] Vérifier la règle de qualification (tiebreaker ordre : points → setDiff → setsWon → confrontation directe)
- [ ] Vérifier que la clé API est générée et partagée avec l'autre équipe dev

### Vérifications techniques

- [ ] Ouvrir `/api/health` → doit retourner `{"status":"ok"}`
- [ ] Ouvrir `/api/public/config` → vérifier que name/status/date/location sont corrects
- [ ] Vérifier le badge keep-alive dans la sidebar admin (vert = actif)
      Si absent ou rouge : aller dans Paramètres → activer le keep-alive
- [ ] Tester la vue joueur sur `/tournoi` depuis un téléphone
      → Les poules/bracket s'affichent (vides pour l'instant, c'est normal)
- [ ] Vérifier que l'autre app reçoit bien les données via `/api/public/*`

---

## Jour J — Matin (avant le tirage)

- [ ] Vérifier que le site est UP (badge Render vert)
- [ ] Confirmer le nombre final d'équipes présentes (absences de dernière minute ?)
- [ ] Supprimer les équipes absentes si nécessaire

---

## Jour J — Tirage au sort

- [ ] Aller dans `/admin/groups`
- [ ] Choisir la taille cible des poules (ex : groupSize 5 → 8 poules pour 41 équipes)
      Règle : `floor(nbEquipes / groupSize)` poules, jamais de poule < 3 équipes
- [ ] Lancer le tirage → vérifier :
      - Nombre de poules créé
      - Nombre de matchs générés (N équipes dans une poule → N×(N-1)/2 matchs)
      - Distribution pays : warnings affichés si 2 équipes du même pays dans la même poule
- [ ] Afficher chaque poule → vérifier que les noms sont corrects
- [ ] Vérifier que la vue joueur `/tournoi` → onglet "Poules" affiche les poules

---

## Jour J — Phase de poules

- [ ] Pour chaque match joué :
      - Aller dans `/admin/groups` → poule concernée → bouton score
      - Saisir S1, S2 (et S3 si égalité 1-1, il s'affiche automatiquement)
      - Vérifier que le classement se met à jour
- [ ] En cas d'erreur de saisie :
      - Rouvrir le match → modifier → Enregistrer (écrase l'ancien)
      - Ou "Réinitialiser" si score complètement erroné
- [ ] Polling actif sur la vue joueur → les scores apparaissent dans les 30 secondes
- [ ] Vérifier régulièrement que le site répond (Render free tier peut dormir)

---

## Fin de phase de poules

- [ ] Attendre que **tous** les matchs de poule soient saisis
- [ ] Vérifier les classements finaux de chaque poule
- [ ] Identifier les cas d'égalité → le tiebreaker est automatique :
      points → setDiff → setsWon → confrontation directe
- [ ] Si égalité persistante non résoluble : ajuster manuellement si besoin

### Génération du bracket

- [ ] Aller dans `/admin/bracket`
- [ ] Choisir `bracketTarget` :
      - 1/16 = 32 équipes (recommandé si ~8 poules de 5)
      - 1/8  = 16 équipes (si peu d'équipes)
- [ ] Générer le bracket principal → vérifier :
      - Nombre d'équipes qualifiées = bracketTarget
      - Wildcards correctement attribués (meilleures 3e/Nème)
      - Pas de match intra-poule au R1
- [ ] Générer le bracket consolante → vérifier :
      - Toutes les équipes éliminées en poule sont présentes
      - Bracket est cohérent
- [ ] Vérifier que la vue joueur affiche les deux brackets

---

## Jour J — Phase finale

- [ ] Saisir les scores du bracket dans `/admin/bracket`
      → Le vainqueur avance automatiquement au tour suivant
- [ ] Idem pour la consolante dans `/admin/consolante`
- [ ] En cas de BYE : le match est automatiquement marqué joué, équipe avance sans jouer

---

## Après le tournoi

- [ ] Vérifier que tous les scores sont saisis (aucun match en attente)
- [ ] Aller dans `/admin/bracket` → noter le vainqueur final
- [ ] **Exporter les résultats CSV** (bouton dans le dashboard)
      → Sauvegarder le fichier localement
- [ ] Partager les résultats avec l'organisation
- [ ] Désactiver le keep-alive (évite les appels inutiles en post-tournoi)
- [ ] Optionnel : changer le statut du tournoi en `"done"` dans Paramètres

---

## Commandes utiles en cas d'urgence

```bash
# Vérifier que l'API répond
curl https://padel-api-dtcf.onrender.com/api/health

# Vérifier le config public (sans clé)
curl https://padel-api-dtcf.onrender.com/api/public/config

# Compter les équipes
curl https://padel-api-dtcf.onrender.com/api/teams/count \
  -H "Authorization: Bearer <jwt_admin>"
```

---

## Contacts & URLs

| Ressource | URL |
|---|---|
| Frontend prod | https://idpp-r5hj.onrender.com |
| API prod | https://padel-api-dtcf.onrender.com |
| Admin | https://idpp-r5hj.onrender.com/admin |
| Vue joueur | https://idpp-r5hj.onrender.com/tournoi |
| Doc API publique | `API.md` à la racine du repo |
