// Stand-in worker: emits progress logs before succeeding, mirroring the log
// callback convertWorker.js hands to convert2xkt.
import { parentPort, workerData } from 'node:worker_threads';

parentPort.postMessage({ type: 'log', message: 'Parsing IFC' });
parentPort.postMessage({ type: 'log', message: 'Writing XKT' });
parentPort.postMessage({ type: 'done', outputPath: workerData.outputPath });
