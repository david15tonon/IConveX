# Exercice — écrire le backend IConveX depuis zéro

L'implémentation a été retirée de cette branche. Les tests, eux, sont restés :
ils tiennent lieu d'énoncé et de correcteur.

**Condition de réussite : `npm test` affiche 33 passants.**

---

## Règles

1. Tu écris tout le code toi-même.
2. Tu ne consultes pas `main`, ni `git log`, ni `git show` sur les fichiers
   supprimés. La solution y est — l'exercice ne vaut que si tu ne l'ouvres pas.
3. Tu peux lire `README.md` (la spécification), `frontend/api.html` (le contrat
   HTTP public) et les tests. C'est le matériel fourni.

## Comment démarrer

Lance `npm test`. La sortie te dit quel module manque. Crée-le, relance, et ainsi
de suite jusqu'à ce que mocha puisse charger les trois fichiers de test. Tu auras
alors 33 tests rouges : c'est le vrai point de départ.

Aucun squelette n'a été laissé volontairement. Les tests décrivent seuls les noms
à exporter et les formes attendues ; c'est à toi de créer les fichiers.

Note que `npm start` lance les tests avant de démarrer le serveur : tant qu'ils
sont rouges, il ne démarrera pas. Utilise `npm run serve` pour lancer le serveur
sans cette barrière pendant que tu travailles.

## Ce qu'il y a à construire

Cinq responsabilités, à garder séparées :

- **la configuration** — lire l'environnement, normaliser, fournir des défauts ;
- **la file de jobs** — mémoriser l'état de chaque travail, limiter le nombre de
  conversions simultanées ;
- **le lancement d'une conversion** — la faire tourner hors du fil principal, et
  traduire sa fin en succès ou en échec ;
- **la réception du fichier** — accepter un multipart, filtrer l'extension,
  plafonner la taille ;
- **le serveur HTTP** — router, valider, traduire en codes de statut.

La frontière qui compte est celle entre la file et la conversion. Si la file
ignore ce qu'est un IFC et se contente d'exécuter un travail qui rend une
promesse, elle devient testable sans rien convertir — et les tests fournis
comptent là-dessus.

## Le cycle de vie d'un job

`queued` → `converting` → `complete` ou `error`

Un job ne recule jamais, et **tout chemin de sortie doit écrire un état final**.
Un job bloqué en `converting` est le pire défaut de ce système : le client, lui,
interroge indéfiniment.

## Points de vigilance

Ces sept situations ont toutes cassé la production de ce projet pour de vrai. On
te dit ce qui arrive, pas comment l'éviter.

1. **Le port.** L'hébergeur l'injecte par variable d'environnement. Lue sans
   précaution quand elle est absente, elle fait mourir le serveur au démarrage.
2. **Les origines CORS.** L'en-tête `Origin` d'un navigateur ne porte jamais de
   slash final. Une configuration qui en contient un rejette tout, en silence,
   sans la moindre erreur côté serveur.
3. **Le coût CPU de la conversion.** Le parsing IFC monopolise le fil
   d'exécution. Pendant ce temps, le serveur ne répond plus à rien — ni au
   polling, ni au test de santé — et l'hébergeur finit par le redémarrer, ce qui
   tue la conversion en cours.
4. **La mort brutale d'un travail.** Un processus tué par manque de mémoire
   n'annonce rien. Si tu ne conclus qu'à la réception d'un message de fin, ce job
   reste `converting` pour toujours.
5. **Le test de santé.** Combiné au point 3, il provoque des redémarrages en
   boucle. Ne l'active qu'une fois sûr que le serveur reste réactif sous charge.
6. **La mémoire est volatile.** Une file en mémoire perd tout au redémarrage. Ce
   n'est pas grave si le client sait l'interpréter — encore faut-il que l'API le
   lui dise clairement.
7. **Le disque aussi.** Les fichiers produits s'accumulent. Rien ne les supprime
   si tu n'écris pas ce qui les supprime.

## Hors sujet

Ne t'occupe pas de l'authentification, de la limitation de débit, ni d'une file
persistante. Le service documenté n'en a pas, et les tests n'en demandent pas.

## Quand tu auras fini

`git diff main -- backend/` te montrera les écarts avec l'implémentation
existante. À lire **après** avoir tes 33 tests au vert, pas avant : ce sont deux
solutions au même problème, pas une correction.
