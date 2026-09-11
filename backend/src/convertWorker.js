import fs from 'node:fs';
import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import { convert2xkt } from '@xeokit/xeokit-convert';

/**
 * Worker entry point for a single IFC -> XKT conversion.
 *
 * convert2xkt is CPU-bound and holds the thread for the whole conversion, so it
 * runs here rather than on the server's main thread. Blocking the main thread
 * made the process answer nothing at all while converting: the health check
 * failed, Render's proxy returned 502s with no CORS headers, and Render
 * eventually restarted the instance mid-conversion.
 *
 * Progress and failures travel back to the parent as messages; see convert.js.
 */

const { inputPath, outputPath } = workerData;

try {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await convert2xkt({
    source: inputPath,
    output: outputPath,
    log: (message) => parentPort.postMessage({ type: 'log', message }),
  });

  if (!fs.existsSync(outputPath)) {
    throw new Error('Conversion finished but no .xkt file was produced.');
  }

  parentPort.postMessage({ type: 'done', outputPath });
} catch (err) {
  // Report the reason before exiting: an 'error' event alone would lose the
  // message that tells the user why their file could not be converted.
  parentPort.postMessage({
    type: 'error',
    message: err && err.message ? err.message : String(err),
  });
}
