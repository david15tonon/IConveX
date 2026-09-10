# Leçons

Format : `[date] | ce qui a mal tourné | règle pour l'éviter`

---

**[2026-09-10] | Le fallback d'une variable d'env a été retiré et a crashé la prod.**
Le commit `fce39db` a changé `Number(process.env.PORT || 3000)` en
`Number(process.env.PORT)`. `.env` est dans `.gitignore`, donc il n'existe jamais
sur l'hôte : `undefined` → `NaN` → `ERR_SOCKET_BAD_PORT`.
**Règle :** ne jamais lire une variable d'env requise sans fallback ou validation
explicite. Préférer `Number(x) || defaut` à `Number(x || defaut)` — la première
forme couvre aussi la chaîne vide. Tester en local avec `env -u VAR` et sans
`.env`, c'est exactement la condition de l'hôte.

**[2026-09-10] | Un serveur long-running configuré comme Build Command.**
`npm start` était défini comme Build Command Vercel. Une commande de build doit
**terminer** ; `app.listen()` ne rend jamais la main. Même sans le bug de port,
le build aurait expiré au lieu de crasher.
**Règle :** distinguer build (termine, produit des artefacts) et start (tourne
indéfiniment). Avant de débugger le code, lire la config de l'hôte : le log
disait `Running "vercel build"` puis `> iconvex-backend@1.0.0 start` — la
contradiction était visible dès la deuxième ligne.

**[2026-09-10] | Origine CORS avec slash final : ne matche jamais.**
`CORS_ORIGIN=https://iconvex-convex.vercel.app/` ne peut pas correspondre à
l'en-tête `Origin` du navigateur, qui n'a jamais de slash final. Comparaison de
chaînes stricte dans `cors`, donc échec silencieux côté navigateur.
**Règle :** normaliser (retirer le slash final) toute URL d'origine. Vérifier
avec `curl -H "Origin: ..." -D-` et confirmer la **présence** de l'en-tête
`Access-Control-Allow-Origin` — un `200 OK` seul ne prouve rien, le blocage CORS
est fait par le navigateur, pas par le serveur.

**[2026-09-10] | Hôte choisi avant d'avoir vérifié le modèle d'exécution.**
Le backend écrit sur disque, garde ses jobs en mémoire, tourne pendant plusieurs
minutes et accepte 200 Mo d'upload — quatre incompatibilités avec le serverless
Vercel (FS en lecture seule hors `/tmp`, isolats sans état partagé, limite de
durée, limite de corps de requête ~4,5 Mo). `node_modules` pèse 113 Mo, proche
de la limite de bundle.
**Règle :** avant de choisir un hôte, lister ce dont le service a besoin :
état persistant ? écriture disque ? durée d'exécution ? taille des requêtes ?
Un service qui répond 202 + polling exige un process persistant, par
construction.

**[2026-09-10] | Le dépôt local était 3 commits derrière ce qui était déployé.**
Le commit déployé (`6fe049c`) contenait le bug ; le local (`79cfa4c`) avait
encore le code correct. Corriger en local puis pousser aurait écrasé les
changements légitimes de `config.js`.
**Règle :** `git fetch` et comparer avec le commit exact indiqué dans le log de
build **avant** de diagnostiquer. Le code qu'on lit n'est pas forcément celui
qui tourne.
