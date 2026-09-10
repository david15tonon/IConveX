# TODO — IConveX

## État actuel (2026-09-10)

**Le frontend passe.** Reste le backend : CORS bloque l'upload.

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

- [ ] **Vercel → Settings → General** : `Root Directory` = `frontend`, et
      supprimer l'override `Build Command` (`npm start`).
      Non scriptable : `vercel.json` ne peut pas définir le Root Directory.
- [ ] **Render → Environment** : mettre `CORS_ORIGIN=https://iconvex.vercel.app`
      (sans slash final), sauvegarder, laisser le service redémarrer.
      **C'est la seule action qui débloque l'upload dès maintenant** : le service
      lit ses variables depuis le dashboard, pas depuis `render.yaml`.
- [ ] Les URLs de Preview Vercel (`iconvex-git-*.vercel.app`) resteront bloquées
      par CORS — les ajouter à `CORS_ORIGIN` si on veut tester en preview.
- [ ] Pousser `fix/vercel-deployment` et la fusionner dans `main`
      (Vercel et Render déploient depuis `main` — rien ne change en prod avant).
- [ ] **Décision** : `MAX_UPLOAD_MB=200` fait sauter l'instance gratuite Render
      (512 Mo) pendant `convert2xkt`. Baisser la limite ou passer à une
      instance payante. Signalé en commentaire dans `render.yaml`.

## Dette connue, non traitée

- [ ] File d'attente en mémoire (`backend/src/jobQueue.js:14`) : perdue à chaque
      redémarrage, et empêche toute mise à l'échelle horizontale (>1 instance
      casse le polling). Remplacer par BullMQ/Redis si le service doit scaler.
- [ ] `frontend/js/config.js:5` : URL backend en dur. Aucun build sur le
      frontend, donc pas d'injection de variable d'env possible en l'état.
