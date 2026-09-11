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

**[2026-09-10] | J'ai propagé un domaine que je n'avais jamais vérifié.**
J'ai repris `https://iconvex-convex.vercel.app` depuis le commit `6fe049c` et je
l'ai recopié dans `render.yaml` et `.env.example`. Le vrai domaine déployé est
`https://iconvex.vercel.app`. J'ai corrigé le slash final avec soin… sur un nom
d'hôte faux depuis le départ, ce qui a coûté un aller-retour complet de déploiement.
**Règle :** une valeur trouvée dans le dépôt n'est pas une valeur vérifiée. Une
URL de production se lit dans le dashboard de l'hébergeur ou dans l'`Origin` d'une
requête réelle, jamais dans un `.env.example`. Corollaire du principe
« ne jamais supposer » de CLAUDE.md : ça couvre aussi les valeurs recopiées.

**[2026-09-10] | Modifier un fichier de config d'infra ne change rien au service qui tourne.**
`render.yaml` ne s'applique qu'à une synchro de blueprint. Le service
`iconvex1.onrender.com` existait avant ce fichier, donc il lit ses variables
depuis le dashboard Render. Idem pour `.env.example`, que rien ne lit jamais.
**Règle :** distinguer config *déclarative* (versionnée, appliquée au provisioning)
et état *runtime* (dashboard, appliqué au redémarrage). Corriger le fichier ne
dispense pas de corriger la variable en place — et inversement.

**[2026-09-10] | Un upload avec barre de progression déclenche un preflight CORS.**
`app.js:172` attache un listener à `xhr.upload`, ce qui rend la requête
« non-simple » : le navigateur envoie un `OPTIONS` avant le `POST`. Un `POST`
`FormData` seul n'aurait pas été preflighté.
**Règle :** tester CORS sur la méthode qui échoue vraiment. Un `GET /api/health`
qui passe ne prouve rien sur un `POST` preflighté — vérifier avec
`curl -X OPTIONS -H "Origin: ..." -H "Access-Control-Request-Method: POST" -D-`
et confirmer la **présence** de l'en-tête, avec un contrôle négatif.

**[2026-09-11] | « No active services » dans un dashboard ne prouve pas qu'un service est arrêté.**
La carte du projet Render affichait « No active services » et j'ai d'abord écrit que
ça changeait le diagnostic. En fait le service tournait : `GET /api/health`
renvoyait `{"ok":true,"service":"iconvex-backend"}`. La carte décrivait un
*regroupement* vide, pas l'état du service — qui était simplement non groupé.
**Règle :** l'état d'un service se lit en l'interrogeant, pas dans une vue
d'inventaire. Avant de réviser un diagnostic sur la foi d'une capture d'écran,
envoyer une requête. Et ne pas confondre couche de présentation et réalité — même
famille d'erreur que « modifier render.yaml ne change pas le service qui tourne ».

**[2026-09-11] | « Erreur CORS » dans le navigateur ne veut pas dire « problème de CORS ».**
Le frontend affichait « No 'Access-Control-Allow-Origin' header is present » en
boucle. CORS était parfaitement configuré : le serveur était simplement muet
(boucle d'événements bloquée par `convert2xkt`), et le proxy Render répondait
`502` à sa place — une réponse d'infrastructure qui, elle, ne porte aucun
en-tête CORS. J'ai failli rechercher un problème d'origine pour la troisième fois.
**Règle :** un message CORS décrit l'en-tête manquant sur *la réponse reçue*, pas
son émetteur. Toujours regarder le **code HTTP** d'abord : `502`/`503` avec un
message CORS = le serveur applicatif n'a pas répondu, cherche côté serveur, pas
côté origine. Le test qui tranche : sonder un endpoint trivial pendant
l'opération lente et regarder le code retour.

**[2026-09-11] | J'ai validé un correctif en mesurant la mauvaise instance.**
Juste après le push, j'ai lancé une conversion puis sondé `/api/health` : 30
réponses à 200, j'ai conclu que le correctif marchait. Faux. Le `POST` était
parti sur l'ancienne instance pendant le redéploiement, et mes sondes
interrogeaient la nouvelle, qui ne convertissait rien. Un serveur au repos répond
200 — je mesurais le vide. Le signe qui aurait dû m'alerter immédiatement :
le job était « Job not found » alors que la santé était parfaite.
**Règle :** ne jamais mesurer pendant un déploiement. Et intégrer au test un
**invariant qui prouve qu'on parle à la même instance** — ici, exiger que le job
reste trouvable à chaque sondage. Un test vert dont on ne peut pas prouver qu'il
a observé la bonne cible ne vaut pas mieux qu'un test non lancé.
