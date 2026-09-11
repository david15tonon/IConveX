import assert from 'node:assert/strict';
import { normalizeOrigin, parseCorsOrigins } from '../src/corsOrigins.js';

describe('parseCorsOrigins', () => {
  it('allows every origin when the setting is absent', () => {
    assert.equal(parseCorsOrigins(undefined), '*');
    assert.equal(parseCorsOrigins(null), '*');
  });

  it('treats an empty or slash-only setting as absent', () => {
    assert.equal(parseCorsOrigins(''), '*');
    assert.equal(parseCorsOrigins('   '), '*');
    assert.equal(parseCorsOrigins(',,'), '*');
  });

  it('returns a single configured origin', () => {
    assert.deepEqual(parseCorsOrigins('https://iconvex.vercel.app'), [
      'https://iconvex.vercel.app',
    ]);
  });

  // Regression: a trailing slash here took production down twice. The browser's
  // Origin header never has one, so the comparison could never match.
  it('strips a trailing slash so the origin can match the Origin header', () => {
    assert.deepEqual(parseCorsOrigins('https://iconvex.vercel.app/'), [
      'https://iconvex.vercel.app',
    ]);
  });

  it('strips repeated trailing slashes', () => {
    assert.deepEqual(parseCorsOrigins('https://iconvex.vercel.app///'), [
      'https://iconvex.vercel.app',
    ]);
  });

  it('splits a comma-separated list and trims each entry', () => {
    assert.deepEqual(
      parseCorsOrigins(' http://localhost:5500 , https://iconvex.vercel.app/ '),
      ['http://localhost:5500', 'https://iconvex.vercel.app']
    );
  });

  it('drops empty entries left by stray commas', () => {
    assert.deepEqual(parseCorsOrigins('https://a.test,,https://b.test'), [
      'https://a.test',
      'https://b.test',
    ]);
  });

  it('leaves an origin without a trailing slash untouched', () => {
    assert.deepEqual(parseCorsOrigins('https://a.test'), ['https://a.test']);
  });
});

describe('normalizeOrigin', () => {
  it('trims surrounding whitespace', () => {
    assert.equal(normalizeOrigin('  https://a.test  '), 'https://a.test');
  });

  it('does not touch the scheme separator', () => {
    assert.equal(normalizeOrigin('https://a.test'), 'https://a.test');
  });

  it('reduces a slash-only value to an empty string', () => {
    assert.equal(normalizeOrigin('/'), '');
  });
});
