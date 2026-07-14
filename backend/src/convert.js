import fs from 'node:fs';
import path from 'node:path';
import { convert2xkt } from '@xeokit/xeokit-convert';

/**
 * Converts an IFC file on disk to an XKT file on disk, using the xeokit-convert
 * library directly (no shelling out to a CLI / child_process needed).
 *
 * @param {string} inputPath  Path to the source .ifc file.
 * @param {string} outputPath Path the .xkt file should be written to.
 * @returns {Promise<string>} Resolves with outputPath on success.
 */
export async function convertIfcToXkt(inputPath, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  await convert2xkt({
    source: inputPath,
    output: outputPath,
    log: (msg) => console.log(`[convert2xkt] ${msg}`),
  });

  if (!fs.existsSync(outputPath)) {
    throw new Error('Conversion finished but no .xkt file was produced.');
  }

  return outputPath;
}
