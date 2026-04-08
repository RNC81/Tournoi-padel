# Projet : Site Tournoi de Padel
## Contexte du projet
Site web complet pour gérer un tournoi de padel en double (2v2).
- ~75 équipes (150-200 joueurs)
- Format : poules puis élimination directe
- Déployé sur Render (free tier)
- Repo GitHub avec déploiement automatique via push
## Stack technique
- **Frontend** : React (Vite)
- **Backend** : Node.js + Express
- **Base de données** : PostgreSQL (Render managed DB)
- **Auth admin** : JWT simple
- **Style** : Tailwind CSS
## Fonctionnalités à construire (dans cet ordre)
1. [ ] Modèles de données (équipes, joueurs, matchs, groupes)
2. [ ] API Backend (CRUD équipes, matchs, scores)
3. [ ] Page inscription des équipes (formulaire public)
4. [ ] Interface admin (gestion du tournoi, saisie scores)
5. [ ] Génération automatique des poules (tirage au sort)
6. [ ] Tableau des matchs de poules
7. [ ] Scores en live (polling toutes les 30s)
8. [ ] Génération automatique du bracket élimination directe
9. [ ] Classements et statistiques
10. [ ] Design final (responsive, propre, moderne)
## Règles de travail IMPORTANTES
### Comment tu dois travailler avec moi
- Je suis débutant en code : **explique toujours ce que tu fais** en 2-3 lignes avant de coder
- Procède **étape par étape**, ne fais jamais 3 choses en même temps
- Si tu dois faire un choix d'architecture, **explique les options** et dis-moi laquelle tu recommandes
- **Demande confirmation** avant de modifier un fichier existant qui fonctionne
- Quand tu crées un fichier, dis-moi à quoi il sert
- A partir de maintenant, ne te contente pas d'être d'accord avec mes idées ou de prendre mes conclusions pour acquises. Je veux un vrai challenge intellectuel, pas juste de l'approbation. Quand je propose une idée, fais ceci : 

Toujours vérifier les hypothèses implicites d’un scénario et demander une clarification dès qu’une information essentielle manque avant de conclure.

Remets en question mes suppositions, qu'est ce que je considère comme vrai sans l'avoir vraiment vérifier.
Adopte un point de vu sceptique, Quelles objections une personne critique et bien informée pourrait-elle soulever? 
Vérifie mon raisonnement, Est ce qu'il y a des failles ou des raccourcis logiques que j'ai ignorés ?
Propose d'autres angles. Comment l'idée pourrait-elle être vue, interprétée ou remise en cause autrement ?
Privilégie l'exactitude à l'approbation. SI mon raisonnement est bancal ou faux, corrige moi clairement et montre moi pourquoi. 
Sois constructif, mais rigoureux. Tu n'es pas là pour contredire pour le plaisir mais pour affiner ma pensée et me garder lucide. 
Et si tu me vois tomber dans le biais ou les croyances infondées, dis le franchement. L'objectif, c'est d'affiner nos conclusions et notre façon d'y parvenir.
  Adopter le style de la génération Z.

Arrête les émojis inutiles
### Notre Workflow : 
Début de session  → "Relis le CLAUDE.md, voilà où on en est"
Avant de coder    → "Propose un plan pour [fonctionnalité X]"
Accord obtenu     → "Go, code"
Fonctionnalité ok → git commit + push
Fin de session    →  ## Gestion de fin de session
Quand tu détectes que le contexte est presque plein (ou quand je dis "fin de session") :
1. Résume ce qu'on a accompli dans cette session
2. Liste les décisions techniques prises
3. Mets à jour la checklist des fonctionnalités dans ce CLAUDE.md
4. Écris un fichier SESSION_NOTES.md avec "reprendre ici : [contexte précis]"
5. Indique-moi que je peux ouvrir une nouvelle session
Au démarrage de chaque session, lis ce CLAUDE.md + SESSION_NOTES.md avant tout.
### Structure des fichiers à respecter
\\\
site-padel/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── utils/
├── server/          # Node/Express backend
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   └── utils/
├── CLAUDE.md        # ce fichier
└── README.md
\\\
### Règles de code
- Commente le code en **français**
- Variables et fonctions en **anglais** (convention JS)
- Toujours gérer les erreurs (try/catch, messages clairs)
- Commits Git fréquents avec des messages clairs en français
- Ne jamais commiter de clés API ou secrets (.env dans .gitignore)
### Git workflow
Après chaque fonctionnalité qui marche :
\\\bash
git add .
git commit -m "feat: description de ce qui a été fait"
git push origin main
\\\
Render redéploie automatiquement après chaque push.
## Référence FIFA
Le dossier ~/Tournoi-FC26-main/ contient un site de tournoi FIFA
en React/Node.js. Tu peux t'en inspirer pour la logique de brackets
et la structure générale, mais on repart d'une base propre.
## Variables d'environnement (.env)
ça va être géré dans render
## Commandes utiles
\\\bash
# Dev
cd client && npm run dev     # frontend sur localhost:5173
cd server && npm run dev     # backend sur localhost:3001
# Build pour prod
cd client && npm run build
# DB
npm run db:migrate           # appliquer les migrations
npm run db:seed              # données de test
\\\
