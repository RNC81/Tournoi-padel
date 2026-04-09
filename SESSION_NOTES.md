# Session Notes — Reprendre ici

## Dernière mise à jour : 2026-04-09

## URLs de production
- Frontend : https://idpp-r5hj.onrender.com/
- Backend  : https://padel-api-dtcf.onrender.com
- GitHub   : https://github.com/RNC81/Tournoi-padel.git

## État actuel du projet

### Ce qui est FAIT et déployé
- [x] Backend complet (Node/Express + MongoDB Atlas)
- [x] Modèles : User, Team, Tournament
- [x] Auth JWT : super_admin (rayaan) + admins
- [x] Routes API : /auth, /teams, /tournament, /qrcode
- [x] Logique groupGenerator.js (poules round-robin, équilibré)
- [x] Logique bracketGenerator.js (bracket 16 ou 32 dynamique, consolante)
- [x] Navbar sticky avec menu Connexion (vue joueur / admin)
- [x] Homepage redesignée style sports editorial (date: 14 & 16 Mai 2026)
- [x] GuestHomePage : vue joueur read-only avec polling 30s
- [x] Page inscription équipe (publique)
- [x] Login admin + Dashboard admin basique
- [x] render.yaml configuré

### Compte super admin
- Username : rayaan
- Mot de passe : PYC2025admin!
- Créé directement en base MongoDB Atlas

### Ce qu'il reste à faire (PROCHAINE SESSION)

**Priorité 1 — Initialiser le tournoi**
- Aller sur https://idpp-r5hj.onrender.com/admin/login
- Se connecter avec rayaan / PYC2025admin!
- Cliquer "Initialiser le tournoi" (crée le document Tournament en base)

**Priorité 2 — Pages admin manquantes**
- AdminTeamsPage : liste des équipes inscrites + suppression
- AdminGroupsPage : affichage des matchs de poule avec formulaire de saisie des scores
- AdminUsersPage : gestion des sous-admins (créer, suspendre, supprimer)

**Priorité 3 — Affichage bracket public**
- BracketPage dans GuestHomePage (remplacer le placeholder)
- Affichage visuel du bracket (arbre d'élimination)
- Même chose pour la consolante

**Priorité 4 — Pages admin bracket**
- AdminBracketPage : saisie des scores du bracket principal
- AdminConsolationPage : saisie des scores de la consolante

**Priorité 5 — Polish final**
- Responsive mobile à vérifier sur tous les écrans
- Vérifier VITE_API_URL sur Render (variable d'env du frontend)
- Tester le flux complet : inscription → poules → bracket

## Variables d'env Render à vérifier
Backend (padel-api-dtcf) :
- MONGODB_URI : mongodb+srv://rnc81:Azertyuiop%402002!@cluster0.ys9gv4v.mongodb.net/padel-tournoi
- JWT_SECRET : PadelPYC_2025_super_secret_jwt_key_ne_pas_partager
- CLIENT_URL : https://idpp-r5hj.onrender.com

Frontend (idpp-r5hj) :
- VITE_API_URL : https://padel-api-dtcf.onrender.com

## Architecture des fichiers clés
- server/utils/groupGenerator.js — tirage des poules
- server/utils/bracketGenerator.js — génération brackets
- server/models/Tournament.js — schéma principal
- client/src/pages/HomePage.jsx — landing page (vitrine)
- client/src/pages/GuestHomePage.jsx — vue joueur read-only
- client/src/components/Navbar.jsx — navigation globale
