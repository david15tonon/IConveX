# IConveX — Frontend

Static site (no build step): plain HTML/CSS/JS + Tailwind via CDN. Talks to
the [backend](../backend) over HTTP.

## Run locally

Any static file server works. For example:

```bash
cd frontend
python3 -m http.server 5500
# open http://localhost:5500
```

or with Node:

```bash
npx serve -l 5500
```

Make sure the backend is running too (see `../backend/README.md`), and that
its `CORS_ORIGIN` includes whichever origin you're serving the frontend
from (`http://localhost:5500` by default).

## Configuration

Edit `js/config.js`:

```js
window.ICONVEX_API_BASE = "http://localhost:3000"; // your backend URL
window.ICONVEX_GITHUB_URL = "https://github.com/your-org/iconvex";
```

## Structure

```
frontend/
├── index.html      landing page + converter widget
├── css/styles.css  status chips, dropzone states, progress animation
├── js/config.js    API base URL / links — edit this per environment
├── js/app.js       upload, job polling, UI state machine
└── assets/logo.png IConveX wordmark
```

## How the converter widget works

1. Pick or drag a `.ifc` file onto the dropzone.
2. The file is uploaded to `POST {API_BASE}/api/convert` with real upload
   progress shown on the bar.
3. Once the upload finishes, the app polls
   `GET {API_BASE}/api/jobs/:id` every 1.5s and updates the status chip and
   the 3-node pipeline diagram (Input → Conversion Engine → Output) to
   match the design system in `DESIGN.md`.
4. When the job is `complete`, a download button appears linking to
   `GET {API_BASE}/api/jobs/:id/download`.
5. On any failure (bad file type, network error, conversion error), the
   pipeline and chip switch to the error state and the message explains
   what happened.

No frameworks, no build step — open `index.html` in any browser (via a
local server, so `fetch`/CORS behave) and it works.
