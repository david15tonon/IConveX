import assert from 'node:assert/strict';
import { createJobQueue } from '../src/jobQueue.js';

/** Resolves once `predicate` holds, so tests never depend on wall-clock timing. */
async function waitFor(predicate, { timeout = 2000, interval = 2 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('Condition was not met before the timeout');
}

/** A promise whose settlement the test controls. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createJobQueue', () => {
  describe('create', () => {
    it('starts a job in the queued state with the details it was given', () => {
      const queue = createJobQueue();
      const job = queue.create({ inputPath: '/tmp/a.ifc', originalName: 'a.ifc' });

      assert.equal(job.status, 'queued');
      assert.equal(job.originalName, 'a.ifc');
      assert.equal(job.inputPath, '/tmp/a.ifc');
      assert.equal(job.outputPath, null);
      assert.equal(job.error, null);
      assert.equal(job.finishedAt, null);
      assert.equal(typeof job.createdAt, 'number');
    });

    it('gives each job a distinct id', () => {
      const queue = createJobQueue();
      const first = queue.create({ inputPath: '/tmp/a', originalName: 'a' });
      const second = queue.create({ inputPath: '/tmp/b', originalName: 'b' });

      assert.notEqual(first.id, second.id);
    });
  });

  describe('get', () => {
    it('finds a job by id', () => {
      const queue = createJobQueue();
      const job = queue.create({ inputPath: '/tmp/a', originalName: 'a' });

      assert.equal(queue.get(job.id), job);
    });

    it('returns undefined for an unknown id', () => {
      const queue = createJobQueue();

      assert.equal(queue.get('does-not-exist'), undefined);
    });
  });

  describe('enqueue', () => {
    it('marks the job complete and records what the work produced', async () => {
      const queue = createJobQueue({ concurrency: 1 });
      const job = queue.create({ inputPath: '/tmp/a.ifc', originalName: 'a.ifc' });

      queue.enqueue(job, async () => '/tmp/a.xkt');
      await waitFor(() => job.status === 'complete');

      assert.equal(job.outputPath, '/tmp/a.xkt');
      assert.equal(job.error, null);
      assert.equal(typeof job.finishedAt, 'number');
    });

    it('passes the job itself to the work function', async () => {
      const queue = createJobQueue({ concurrency: 1 });
      const job = queue.create({ inputPath: '/tmp/a.ifc', originalName: 'a.ifc' });
      let received = null;

      queue.enqueue(job, async (j) => {
        received = j;
        return '/tmp/a.xkt';
      });
      await waitFor(() => job.status === 'complete');

      assert.equal(received, job);
    });

    it('moves the job to converting while the work runs', async () => {
      const queue = createJobQueue({ concurrency: 1 });
      const job = queue.create({ inputPath: '/tmp/a.ifc', originalName: 'a.ifc' });
      const work = deferred();

      queue.enqueue(job, () => work.promise);
      await waitFor(() => job.status === 'converting');

      work.resolve('/tmp/a.xkt');
      await waitFor(() => job.status === 'complete');
    });

    it('records the reason when the work rejects', async () => {
      const queue = createJobQueue({ concurrency: 1 });
      const job = queue.create({ inputPath: '/tmp/a.ifc', originalName: 'a.ifc' });

      queue.enqueue(job, async () => {
        throw new Error('web-ifc could not parse the file');
      });
      await waitFor(() => job.status === 'error');

      assert.equal(job.error, 'web-ifc could not parse the file');
      assert.equal(job.outputPath, null);
      assert.equal(typeof job.finishedAt, 'number');
    });

    it('still records a reason when the work rejects with a non-Error', async () => {
      const queue = createJobQueue({ concurrency: 1 });
      const job = queue.create({ inputPath: '/tmp/a.ifc', originalName: 'a.ifc' });

      queue.enqueue(job, () => Promise.reject('plain string failure'));
      await waitFor(() => job.status === 'error');

      assert.equal(job.error, 'plain string failure');
    });

    it('keeps running later jobs after one fails', async () => {
      const queue = createJobQueue({ concurrency: 1 });
      const failing = queue.create({ inputPath: '/tmp/a', originalName: 'a' });
      const following = queue.create({ inputPath: '/tmp/b', originalName: 'b' });

      queue.enqueue(failing, async () => {
        throw new Error('boom');
      });
      queue.enqueue(following, async () => '/tmp/b.xkt');

      await waitFor(() => following.status === 'complete');
      assert.equal(failing.status, 'error');
    });
  });

  describe('concurrency', () => {
    it('never runs more jobs at once than allowed', async () => {
      const queue = createJobQueue({ concurrency: 2 });
      let running = 0;
      let peak = 0;
      const gates = [];

      for (let i = 0; i < 5; i += 1) {
        const job = queue.create({ inputPath: '/tmp/' + i, originalName: i + '.ifc' });
        const gate = deferred();
        gates.push(gate);

        queue.enqueue(job, async () => {
          running += 1;
          peak = Math.max(peak, running);
          await gate.promise;
          running -= 1;
          return '/tmp/' + i + '.xkt';
        });
      }

      await waitFor(() => running === 2);
      assert.equal(peak, 2, 'a third job started before a slot was free');

      gates.forEach((gate) => gate.resolve());
      await waitFor(() => queue.allJobs().every((job) => job.status === 'complete'));
      assert.equal(peak, 2);
    });

    it('starts a waiting job as soon as a slot frees up', async () => {
      const queue = createJobQueue({ concurrency: 1 });
      const first = queue.create({ inputPath: '/tmp/a', originalName: 'a' });
      const second = queue.create({ inputPath: '/tmp/b', originalName: 'b' });
      const gate = deferred();

      queue.enqueue(first, () => gate.promise);
      queue.enqueue(second, async () => '/tmp/b.xkt');

      await waitFor(() => first.status === 'converting');
      assert.equal(second.status, 'queued', 'the second job should still be waiting');

      gate.resolve('/tmp/a.xkt');
      await waitFor(() => second.status === 'complete');
    });
  });

  describe('allJobs and remove', () => {
    it('lists every job it knows about', () => {
      const queue = createJobQueue();
      const first = queue.create({ inputPath: '/tmp/a', originalName: 'a' });
      const second = queue.create({ inputPath: '/tmp/b', originalName: 'b' });

      assert.deepEqual(
        queue.allJobs().map((job) => job.id).sort(),
        [first.id, second.id].sort()
      );
    });

    it('forgets a removed job', () => {
      const queue = createJobQueue();
      const job = queue.create({ inputPath: '/tmp/a', originalName: 'a' });

      queue.remove(job.id);

      assert.equal(queue.get(job.id), undefined);
      assert.deepEqual(queue.allJobs(), []);
    });

    it('ignores removal of an unknown id', () => {
      const queue = createJobQueue();
      queue.create({ inputPath: '/tmp/a', originalName: 'a' });

      queue.remove('does-not-exist');

      assert.equal(queue.allJobs().length, 1);
    });
  });
});
