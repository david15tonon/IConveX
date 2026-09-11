// Stand-in worker: reports a conversion failure the way convertWorker.js does
// when convert2xkt throws.
import { parentPort } from 'node:worker_threads';

parentPort.postMessage({ type: 'error', message: 'web-ifc refused the file' });
