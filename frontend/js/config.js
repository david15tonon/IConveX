// Point this at wherever the IConveX backend is running.
// For local dev with `npm start` in /backend, the default is fine.
// For production, replace with your deployed backend URL
// (e.g. "https://api.votredomaine.com") — no trailing slash.
// iconvex1.onrender.com appartient à un compte Render auquel on n'a plus accès ;
// le backend est redéployé via render.yaml sous le nom "iconvex-backend".
// À confirmer dans le dashboard après le premier déploiement — sans slash final.
window.ICONVEX_API_BASE = window.ICONVEX_API_BASE || "https://iconvex-backend.onrender.com";

// Optional: link the "GitHub" buttons in the header/footer to your repo.
window.ICONVEX_GITHUB_URL = window.ICONVEX_GITHUB_URL || "https://github.com/";
