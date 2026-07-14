import { randomUUID } from 'node:crypto';

/**
 * Very small in-memory job queue.
 *
 * Each job moves through: queued -> converting -> complete | error
 *
 * This is intentionally simple (no Redis/Bull) so the project stays easy to
 * run and hack on. If you need horizontal scaling or persistence across
 * restarts, swap this module for a real queue (BullMQ, etc.) — the rest of
 * the app only talks to the small API below.
 */
export function createJobQueue({ concurrency = 2 } = {}) {
  const jobs = new Map();
  const pending = [];
  let running = 0;

  function get(jobId) {
    return jobs.get(jobId);
  }

  function create({ inputPath, originalName }) {
    const id = randomUUID();
    const job = {
      id,
      status: 'queued', // queued | converting | complete | error
      originalName,
      inputPath,
      outputPath: null,
      error: null,
      createdAt: Date.now(),
      finishedAt: null,
    };
    jobs.set(id, job);
    return job;
  }

  function enqueue(job, workFn) {
    pending.push({ job, workFn });
    processNext();
  }

  function processNext() {
    if (running >= concurrency || pending.length === 0) return;

    const { job, workFn } = pending.shift();
    running += 1;
    job.status = 'converting';

    Promise.resolve()
      .then(() => workFn(job))
      .then((outputPath) => {
        job.status = 'complete';
        job.outputPath = outputPath;
        job.finishedAt = Date.now();
      })
      .catch((err) => {
        job.status = 'error';
        job.error = err && err.message ? err.message : String(err);
        job.finishedAt = Date.now();
      })
      .finally(() => {
        running -= 1;
        processNext();
      });
  }

  function allJobs() {
    return [...jobs.values()];
  }

  function remove(jobId) {
    jobs.delete(jobId);
  }

  return { create, enqueue, get, allJobs, remove };
}
