/**
 * Parsing of the CORS_ORIGIN setting.
 *
 * This lives in its own module because getting it wrong is silent: the server
 * starts fine, answers every request, and the browser blocks them all with a
 * message that blames CORS rather than the configuration. It has already caused
 * two production incidents, so it is worth a regression test.
 */

/**
 * Strips surrounding whitespace and any trailing slashes from one origin.
 *
 * The browser's Origin header never carries a trailing slash, so an entry like
 * "https://example.com/" can never match anything.
 *
 * @param {string} value
 * @returns {string}
 */
export function normalizeOrigin(value) {
  return String(value).trim().replace(/\/+$/, '');
}

/**
 * Turns the raw CORS_ORIGIN value into something the `cors` middleware accepts.
 *
 * @param {string|undefined|null} value Comma-separated origins, or nothing.
 * @returns {string[]|'*'} The allowed origins, or '*' when none are configured.
 */
export function parseCorsOrigins(value) {
  if (value === undefined || value === null) return '*';

  const origins = String(value).split(',').map(normalizeOrigin).filter(Boolean);

  // No usable entry means nothing was really configured — same as unset.
  return origins.length > 0 ? origins : '*';
}
