// Stand-in worker: reports success immediately, the way convertWorker.js does
// once convert2xkt has written the file.
import { parentPort, workerData } from 'node:worker_threads';

parentPort.postMessage({ type: 'done', outputPath: workerData.outputPath });
