# IConveX — Backend

Express API that converts uploaded `.ifc` (BIM) files to `.xkt`, using the
[`@xeokit/xeokit-convert`](https://github.com/xeokit/xeokit-convert) library
directly (no CLI child process — the converter is called as a JS function).

## Requirements

- Node.js 20.6+ (for the built-in `--env-file-if-exists` flag used by `npm start`)

## Install & run

```bash
cd backend
npm install
cp .env.example .env   # then adjust CORS_ORIGIN etc.
npm start
```

The server listens on `http://localhost:3000` by default.

## How conversion works

1. `POST /api/convert` accepts a single `.ifc` file (`multipart/form-data`,
   field name `file`) and immediately returns a `jobId`. The conversion runs
   in the background.
2. The frontend polls `GET /api/jobs/:jobId` until `status` becomes
   `complete` (or `error`).
3. Once complete, the response includes a `downloadUrl` — `GET` it to
   receive the `.xkt` file.

This job-based flow (instead of one long blocking request) is what lets the
UI show live "Pending → Converting → Complete" states, and avoids HTTP
timeouts on large models.

A tiny in-memory queue (`src/jobQueue.js`) limits how many conversions run
at once (`MAX_CONCURRENT_CONVERSIONS`), since IFC parsing is CPU/memory
heavy. Finished jobs and their files are deleted automatically after
`JOB_TTL_MINUTES`.

## API

| Method | Path                        | Description                                   |
|--------|-----------------------------|------------------------------------------------|
| GET    | `/api/health`               | Liveness check                                 |
| POST   | `/api/convert`               | Upload an `.ifc` file, returns `{ jobId }`     |
| GET    | `/api/jobs/:jobId`            | Job status: `queued`/`converting`/`complete`/`error` |
| GET    | `/api/jobs/:jobId/download`   | Downloads the resulting `.xkt` file            |

## Configuration (`.env`)

See `.env.example` for all options: port, allowed CORS origins, max upload
size, job retention time, and conversion concurrency.

## Notes for production

- This queue is in-memory and single-process — jobs are lost on restart and
  it won't scale across multiple instances as-is. For that, swap
  `src/jobQueue.js` for a persistent queue (e.g. BullMQ + Redis); the rest
  of the app only depends on the small `create/enqueue/get` API it exposes.
- Put this behind a reverse proxy (nginx/Caddy) with HTTPS in production.
- Large IFC files can take a while and use significant memory — size your
  server accordingly and tune `MAX_CONCURRENT_CONVERSIONS`.
