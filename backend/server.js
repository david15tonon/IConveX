import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJobQueue } from './src/jobQueue.js';
import { convertIfcToXkt } from './src/convert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT );
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 200);
const JOB_TTL_MINUTES = Number(process.env.JOB_TTL_MINUTES || 60);
const MAX_CONCURRENT_CONVERSIONS = Number(process.env.MAX_CONCURRENT_CONVERSIONS || 2);
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : '*';

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });

const queue = createJobQueue({ concurrency: MAX_CONCURRENT_CONVERSIONS });

// ---------------------------------------------------------------------------
// Upload handling
// ---------------------------------------------------------------------------

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.ifc') {
      cb(null, true);
    } else {
      cb(new Error('Only .ifc files are accepted.'));
    }
  },
});

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'iconvex-backend' });
});

app.post('/api/convert', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file received. Send it as multipart field "file".' });
    }

    const job = queue.create({
      inputPath: req.file.path,
      originalName: req.file.originalname,
    });

    const outputName = `${path.basename(req.file.path, path.extname(req.file.path))}.xkt`;
    const outputPath = path.join(OUTPUTS_DIR, outputName);

    queue.enqueue(job, async (j) => {
      try {
        return await convertIfcToXkt(j.inputPath, outputPath);
      } finally {
        // The source IFC is no longer needed once conversion has finished
        // (successfully or not) — remove it to keep disk usage down.
        fs.unlink(j.inputPath, () => {});
      }
    });

    res.status(202).json({ jobId: job.id, status: job.status });
  });
});

app.get('/api/jobs/:jobId', (req, res) => {
  const job = queue.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  res.json({
    id: job.id,
    status: job.status,
    originalName: job.originalName,
    error: job.error,
    downloadUrl: job.status === 'complete' ? `/api/jobs/${job.id}/download` : null,
  });
});

app.get('/api/jobs/:jobId/download', (req, res) => {
  const job = queue.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (job.status !== 'complete' || !job.outputPath || !fs.existsSync(job.outputPath)) {
    return res.status(409).json({ error: 'Job is not complete yet.' });
  }

  const downloadName = `${path.basename(job.originalName, path.extname(job.originalName))}.xkt`;
  res.download(job.outputPath, downloadName);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ---------------------------------------------------------------------------
// Housekeeping: delete finished jobs (and their files) past the configured TTL
// ---------------------------------------------------------------------------

setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MINUTES * 60 * 1000;
  for (const job of queue.allJobs()) {
    const finishedAt = job.finishedAt || job.createdAt;
    if (finishedAt < cutoff) {
      if (job.outputPath) fs.unlink(job.outputPath, () => {});
      if (job.inputPath) fs.unlink(job.inputPath, () => {});
      queue.remove(job.id);
    }
  }
}, 5 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`IConveX backend listening on http://localhost:${PORT}`);
});
