// Where the IConveX backend is running. No trailing slash: the browser's Origin
// header never has one, and the server compares the two.
// Running locally? Use "http://localhost:3000" with `npm start` in /backend.
window.ICONVEX_API_BASE = window.ICONVEX_API_BASE || "https://iconvex-backend.onrender.com";

// Target of the "GitHub" links in the header and the footer.
window.ICONVEX_GITHUB_URL = window.ICONVEX_GITHUB_URL || "https://github.com/david15tonon/IConveX";
