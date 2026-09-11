import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, 'convertWorker.js');

/**
 * Converts an IFC file on disk to an XKT file on disk.
 *
 * The conversion itself runs in a worker thread (see convertWorker.js) so that
 * the server keeps answering requests while it works — job polling and the
 * health check both depend on that.
 *
 * @param {string} inputPath  Path to the source .ifc file.
 * @param {string} outputPath Path the .xkt file should be written to.
 * @param {object} [options]
 * @param {string} [options.workerPath] Worker script to run. Overridable so the
 *   worker lifecycle below can be tested with instant stand-ins, rather than
 *   loading web-ifc on every run of a suite that gates server startup.
 * @returns {Promise<string>} Resolves with outputPath on success.
 */
export function convertIfcToXkt(inputPath, outputPath, { workerPath = WORKER_PATH } = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: { inputPath, outputPath },
    });

    let result = null;
    let failure = null;

    worker.on('message', (msg) => {
      if (msg.type === 'log') {
        console.log(`[convert2xkt] ${msg.message}`);
      } else if (msg.type === 'done') {
        result = msg.outputPath;
      } else if (msg.type === 'error') {
        failure = new Error(msg.message);
      }
    });

    worker.on('error', (err) => {
      failure = failure || err;
    });

    // Settle on 'exit' rather than on the message: a worker killed outright
    // (out of memory, for instance) never sends one, and that case has to
    // reject rather than leave the job stuck in 'converting' forever.
    worker.on('exit', (code) => {
      if (failure) return reject(failure);
      if (result) return resolve(result);
      reject(new Error(`Conversion worker stopped unexpectedly (exit code ${code}).`));
    });
  });
}
