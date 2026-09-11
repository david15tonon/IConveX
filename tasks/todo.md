# TODO — IConveX

## État actuel (2026-09-10)

**La chaîne complète fonctionne** : upload → conversion → téléchargement,
vérifié en prod le 2026-09-11. Reste de la finition (SEO, dette connue).

Le déploiement Vercel échouait au build. Cause racine trouvée et corrigée ;
il reste des actions **côté dashboards** que le code ne peut pas faire.

Architecture retenue : **Vercel = `frontend/` statique uniquement**,
**Render = `backend/` (process persistant)**. Le backend Express ne peut pas
tourner en serverless (voir `tasks/lessons.md`, leçon 4).

---

## Fait — commité sur la branche `fix/vercel-deployment`

- [x] Restaurer le fallback de port — `backend/server.js:14`
      `Number(process.env.PORT) || 3000` (couvre unset *et* chaîne vide)
- [x] Ajouter l'override `DATA_DIR` pour `uploads/` + `outputs/` — `backend/server.js:22-28`
- [x] Retirer le slash final de `CORS_ORIGIN` — `backend/.env.example:10`
- [x] Corriger le domaine : `iconvex-convex.vercel.app` → `iconvex.vercel.app`
      (le premier n'a jamais existé, cf. `lessons.md`)
- [x] Normaliser les origines côté serveur — `backend/server.js:18-25`
- [x] Réparer le 404 de la police Geist — `frontend/index.html:13` (Google Fonts)
- [x] Épingler Node — `backend/package.json:13` → `"22.x"`
- [x] Créer `frontend/vercel.json` (site statique : pas de framework, pas de build,
      `outputDirectory: "."`, `no-cache` sur `js/config.js`)
- [x] Créer `render.yaml` (blueprint backend, disque persistant en option commentée)

### Preuves de vérification
- Boot sans `PORT` ni `.env` → `listening on http://localhost:3000`,
  `/api/health` → `{"ok":true,"service":"iconvex-backend"}`
- `Origin` sans slash → en-tête `Access-Control-Allow-Origin` présent
- `Origin` avec slash (ancienne valeur) → en-tête **absent** (bug confirmé)
- `DATA_DIR` → `uploads/` et `outputs/` créés au chemin surchargé

---

## À faire

- [x] **Vercel → Settings → General** : `Root Directory` = `frontend`, override
      `Build Command` supprimé. Vérifié : `https://iconvex.vercel.app` sert bien
      la page et la police Geist corrigée.
- [x] **Backend redéployé sur le compte actuel (2026-09-11).**
      `iconvex-backend` — `https://iconvex-backend.onrender.com`,
      Service ID `srv-dahtbv67bikc73dmvsfg`, Blueprint managed, depuis `7f47a2a`.
      Le hostname prédit était le bon : aucun changement de `config.js` nécessaire.
      Détail historique : `iconvex1.onrender.com`
      appartient à un ancien compte devenu inaccessible : impossible d'y changer
      `CORS_ORIGIN`. Il tourne encore, mais on ne peut plus rien y faire.
      Voie : Render → New → Blueprint → dépôt `david15tonon/IConveX` → lit
      `render.yaml` (qui porte déjà le bon `CORS_ORIGIN`, donc pas d'étape dashboard
      cette fois). Hostname attendu : `iconvex-backend.onrender.com` (vérifié libre
      le 2026-09-11 via `x-render-routing: no-server`).
- [x] URL confirmée, `frontend/js/config.js:8` déjà juste.
- [x] **Chaîne complète vérifiée de bout en bout (2026-09-11)**, avec
      `Origin: https://iconvex.vercel.app` sur chaque appel :
      - preflight `OPTIONS /api/convert` → `204` + `access-control-allow-origin`
      - `POST /api/convert` (IFC2X3 minimal, 786 o) → `202` + `jobId`
      - `GET /api/jobs/:id` → `"status":"complete"`
      - `GET /api/jobs/:id/download` → `200`, 528 o,
        `content-disposition: attachment; filename="minimal.xkt"`,
        entête XKT version 12 (les 4 premiers octets valent 12, 0, 0, 0)
- [ ] ~~Render → Environment → `CORS_ORIGIN`~~ — caduc : plus d'accès au compte
      (sans slash final), sauvegarder, laisser le service redémarrer.
      **C'est la seule action qui débloque l'upload dès maintenant** : le service
      lit ses variables depuis le dashboard, pas depuis `render.yaml`.
- [ ] Les URLs de Preview Vercel (`iconvex-git-*.vercel.app`) resteront bloquées
      par CORS — les ajouter à `CORS_ORIGIN` si on veut tester en preview.
- [x] `fix/vercel-deployment` fusionnée dans `main` (`f356b8a`). La PR #1 n'avait
      embarqué que les 2 premiers commits ; les 3 suivants ont été poussés ensuite.
- [x] **Décision (2026-09-11) : `MAX_UPLOAD_MB` reste à 200.** Arbitré par David,
      ne pas reproposer de le baisser. Conséquence acceptée : sur l'instance
      gratuite (512 Mo), un IFC volumineux peut faire sauter le process pendant
      `convert2xkt` ; la file étant en mémoire, le job disparaît avec lui et le
      frontend restera en polling jusqu'à l'erreur. Si ça se produit en vrai,
      c'est la piste à regarder en premier — pas un bug à chercher ailleurs.

## EN COURS — le frontend abandonne pendant la conversion (2026-09-11)

### Symptôme
Le navigateur affiche « blocked by CORS policy: No 'Access-Control-Allow-Origin'
header » sur `GET /api/jobs/:id`, en boucle, *pendant* la conversion. Puis plus
rien. Le job, lui, se termine correctement côté serveur.

### Cause racine (mesurée, pas supposée)
`convert2xkt` est CPU-bound et s'exécute sur le thread principal de Node : il
**bloque la boucle d'événements**. Sur l'instance gratuite Render (0,1 CPU) le
process ne répond plus à rien pendant toute la conversion, et c'est le proxy
Render qui répond à sa place — un **502 sans en-tête CORS**. Le navigateur
signale donc une erreur CORS là où le vrai problème est « le serveur est muet ».

Sonde de `/api/health` pendant une conversion (IFC de 1,7 Mo, 4000 éléments) :
essais 1-2 timeout à 8 s, essais 3-9 `502` sans `access-control-allow-origin`,
essais 10-20 `200` avec l'en-tête. CORS n'a jamais été en cause ici.

### Second défaut, indépendant
`frontend/js/app.js` arrête le polling à la **première** réponse non-ok
(`stopPolling()` + `showError()`). Un client qui interroge un job devrait
survivre à un incident passager. C'est pour ça que l'utilisateur voit un échec
alors que la conversion, elle, réussit.

### ✅ CORRIGÉ ET VÉRIFIÉ EN PRODUCTION (2026-09-11, `7664556`)
Sonde de 87 appels à `/api/health` pendant une conversion réelle du fichier de
1,7 Mo : **200 partout, CORS présent, 0 non-200, job jamais perdu**. Conversion
menée à son terme, `.xkt` de 1 915 808 octets téléchargé — taille identique à
celle obtenue en local. Avant correctif, la même sonde donnait timeouts puis 502.

Durée réelle sur 0,1 CPU : plusieurs minutes pour ce fichier. Le worker supprime
le blocage, pas la lenteur.

### Plan (implémenté)
1. **Backend** : sortir `convert2xkt` du thread principal via `worker_threads`.
   Nouveau `backend/src/convertWorker.js` ; `convert.js` devient un mince
   lanceur qui résout/rejette sur `message`/`error`/`exit`. L'API de
   `jobQueue.js` ne bouge pas (elle prend déjà un `workFn` qui rend une promesse).
2. **Frontend** : tolérer les échecs passagers de polling (N tentatives avant
   d'abandonner), et distinguer « serveur momentanément indisponible » de
   « job en erreur » dans le message affiché.
3. Vérifier en rejouant la même sonde : `/api/health` doit rester à `200`
   pendant toute la conversion.

Réserve honnête : même corrigé, 0,1 CPU reste 0,1 CPU. Le worker empêche le
blocage, il ne rend pas la conversion rapide. Et deux workers concurrents
(`MAX_CONCURRENT_CONVERSIONS=2`) sur 512 Mo méritent d'être surveillés.

## EN COURS — suite de tests unitaires mocha (2026-09-11)

### Décisions (arbitrées par David)
- Les tests tournent **au build Render ET à chaque `npm start`**. Conséquence
  assumée : mocha va dans `dependencies`, pas `devDependencies` — sinon
  `npm start` échouerait en production et le serveur ne démarrerait jamais.
- Périmètre : **unités pures**. Pas de refactor de `server.js` ni de supertest.

### Contrainte qui guide la conception
Puisque la suite s'exécute à chaque démarrage, elle doit rester **rapide**.
Charger `@xeokit/xeokit-convert` dans un test ajouterait plusieurs secondes à
chaque cold start du plan gratuit. D'où l'injection d'un chemin de worker dans
`convertIfcToXkt`, qui permet de tester la logique de cycle de vie du worker
avec de faux workers instantanés, sans jamais charger web-ifc.

### ✅ FAIT ET VÉRIFIÉ (2026-09-11)
**33 tests, 0,5 s.** Assez rapide pour gater chaque démarrage.

Barrière prouvée dans les deux sens :
- verts → `33 passing` puis `listening` (dans cet ordre, dans la sortie de `npm start`)
- rouges → code de sortie 4, aucun `listening`, port fermé (`curl` → 000)

Suite prouvée non-complaisante par mutation du code source :
- supprimer le nettoyage du slash final → **4 tests tombent**
- supprimer la limite de concurrence → **2 tests tombent**
- code restauré → 33 au vert

### Travaux
1. Extraire l'analyse de `CORS_ORIGIN` de `server.js` vers `src/corsOrigins.js`.
   C'est le bug qui a mordu deux fois : il mérite un test de non-régression.
2. `convert.js` : accepter un `workerPath` optionnel (par défaut le vrai worker)
   pour rendre testable la logique `message`/`error`/`exit`.
3. `test/corsOrigins.test.js` — slash final, espaces, entrées vides, absence.
4. `test/jobQueue.test.js` — cycle de vie, erreurs, concurrence, remove.
5. `test/convert.test.js` — résolution, rejet sur message d'erreur, et rejet
   quand le worker meurt sans rien dire (le cas OOM).
6. `package.json` : mocha en `dependencies`, `test`, et `start` précédé des tests.
7. `render.yaml` : `buildCommand: npm ci && npm test`.

### Risque à garder en tête
Un test instable (flaky) fera tomber la production, puisque `npm start` en
dépend. La suite doit être déterministe : aucun appel réseau, aucune horloge
murale, aucune conversion réelle.

## EN COURS — version anglaise + SEO (2026-09-11)

### Décisions (arbitrées par David)
- **Une seule URL**, bascule côté client, exactement le modèle `test_site` :
  les deux langues dans le DOM, CSS en masque une, bouton + `localStorage`.
- **Anglais par défaut** sur `/`.

Conséquence SEO assumée : avec une seule URL pour deux langues, `hreflang` n'a
pas de sens et Google indexera un mélange des deux textes. Tout le reste du SEO
(canonical, Open Graph, Twitter, robots, sitemap, données structurées) reste
pleinement applicable et sera fait.

### Emprunts à test_site
- Bascule : `html.lang-en` / `html.lang-fr` + `.lang-en .fr-text { display: none }`
- Bouton `#langBtn`, `hidden` dans le HTML et révélé par le JS
  (amélioration progressive : sans JS, pas de bouton mort)
- Persistance `localStorage`, événement `site:language` pour re-rendre
- Jeu de méta : author, robots, canonical, og:*, twitter:*, og:locale:alternate

### Difficulté principale
`app.js` réécrit `#dropzone-title`, `#dropzone-subtitle`, `#status-message`,
`#file-name`, `#status-chip` et `#footer-copy`. Ces œufs-là ne peuvent pas
contenir de `<span>` bilingues : le premier `textContent =` les écraserait et la
bascule serait cassée. Il leur faut un dictionnaire `t()` **et** un re-rendu
déclenché par le changement de langue, sinon le texte déjà affiché resterait
figé dans l'ancienne langue.

### ✅ FAIT ET VÉRIFIÉ EN NAVIGATEUR (2026-09-11)
Pilotage d'un navigateur réel sur la page servie : **0 erreur console, 0 requête
en échec**, et chaque point contrôlé :

| État | `html` | h1 | Dropzone (piloté par JS) | Bouton |
|---|---|---|---|---|
| Au chargement | `lang="en"` `.lang-en` | « Automate your BIM workflows » | « Drop your IFC file here » | `FR` |
| Après bascule | `lang="fr"` `.lang-fr` | « Automatisez vos workflows BIM » | « Déposez votre fichier IFC » | `EN` |
| Après rechargement | `lang="fr"` conservé | français | français | `EN` |
| Retour à l'anglais + rechargement | `lang="en"` conservé | anglais | anglais | `FR` |

Le dropzone et le pied de page suivent bien la langue : c'est ce qui prouve que
le re-rendu fonctionne, puisque ce sont justement les éléments réécrits par le JS.
`aria-label` bascule aussi (« Passer en français » / « Switch to English »).
Captures des deux langues inspectées : aucune mise en page cassée, aucun texte
en double.

Dictionnaire vérifié symétrique : 21 clés de chaque côté, aucune orpheline,
aucune clé utilisée sans traduction.

### Travaux (faits)
1. `js/i18n.js` (nouveau) : dictionnaire, `t()`, `applyLanguage()`, persistance,
   câblage du bouton, événement de changement.
2. `index.html` : `lang="en"`, tête SEO complète, spans bilingues sur tout le
   texte statique, bouton de langue dans la nav.
3. `js/app.js` : passer les chaînes dynamiques par `t()`, mémoriser l'état
   affiché et le re-rendre à chaque bascule. Formats localisés (Mo / MB).
4. `css/styles.css` : le sélecteur de masquage + style du bouton.
5. SEO : `robots.txt`, `sitemap.xml` **dans `frontend/`** (celui à la racine du
   dépôt est vide et hors du Root Directory Vercel : il ne serait jamais servi),
   `site.webmanifest`, données structurées JSON-LD.
6. Vérification en navigateur réel : bascule, persistance, absence d'erreur
   console, et texte dynamique qui suit bien la langue.

### Réserve
`assets/logo.png` fait 1422×283, un format bannière. Utilisé en `og:image` il
sera recadré ou encadré de bandes par les réseaux sociaux, qui attendent du
1200×630. À remplacer par une vraie image d'aperçu un jour.

## Dette connue, non traitée

- [ ] File d'attente en mémoire (`backend/src/jobQueue.js:14`) : perdue à chaque
      redémarrage, et empêche toute mise à l'échelle horizontale (>1 instance
      casse le polling). Remplacer par BullMQ/Redis si le service doit scaler.
- [ ] `frontend/js/config.js:5` : URL backend en dur. Aucun build sur le
      frontend, donc pas d'injection de variable d'env possible en l'état.
