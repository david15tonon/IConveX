import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertIfcToXkt } from '../src/convert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(__dirname, 'fixtures', name);

// These exercise the worker lifecycle with stand-in workers rather than real
// conversions. The suite gates server startup, so it must not spend seconds
// loading web-ifc; what matters here is that every way a worker can end is
// turned into the right promise outcome.
describe('convertIfcToXkt', () => {
  it('resolves with the output path the worker reports', async () => {
    const result = await convertIfcToXkt('/tmp/in.ifc', '/tmp/out.xkt', {
      workerPath: fixture('worker-done.js'),
    });

    assert.equal(result, '/tmp/out.xkt');
  });

  it('forwards the input and output paths to the worker', async () => {
    const result = await convertIfcToXkt('/tmp/other.ifc', '/tmp/elsewhere.xkt', {
      workerPath: fixture('worker-done.js'),
    });

    assert.equal(result, '/tmp/elsewhere.xkt');
  });

  it('rejects with the reason the worker reported', async () => {
    await assert.rejects(
      convertIfcToXkt('/tmp/in.ifc', '/tmp/out.xkt', {
        workerPath: fixture('worker-error.js'),
      }),
      /web-ifc refused the file/
    );
  });

  // A worker killed outright never gets to send a message. Without this, the
  // job would sit in 'converting' forever and the frontend would poll for ever.
  it('rejects when the worker dies without reporting anything', async () => {
    await assert.rejects(
      convertIfcToXkt('/tmp/in.ifc', '/tmp/out.xkt', {
        workerPath: fixture('worker-silent.js'),
      }),
      /stopped unexpectedly \(exit code 3\)/
    );
  });

  it('rejects when the worker throws before reporting', async () => {
    await assert.rejects(
      convertIfcToXkt('/tmp/in.ifc', '/tmp/out.xkt', {
        workerPath: fixture('worker-throws.js'),
      }),
      /worker blew up on startup/
    );
  });

  it('ignores progress logs and still resolves', async () => {
    const result = await convertIfcToXkt('/tmp/in.ifc', '/tmp/out.xkt', {
      workerPath: fixture('worker-logs-then-done.js'),
    });

    assert.equal(result, '/tmp/out.xkt');
  });

  it('rejects when the worker script does not exist', async () => {
    await assert.rejects(
      convertIfcToXkt('/tmp/in.ifc', '/tmp/out.xkt', {
        workerPath: fixture('no-such-worker.js'),
      })
    );
  });
});
