/**
 * lib/apiHeaders.js
 *
 * Shared browser-like headers for every Runflix API call.
 *
 * Point D fix: api.runflix.name.ng blocks requests without a browser
 * User-Agent with 403 "internal use only". Including these headers in
 * every direct fetch call prevents that filter from triggering.
 *
 * runflixPatch.js injects these automatically at the transport level,
 * but having them explicitly in each command is a belt-and-suspenders
 * safety net for environments where the patch may not apply (e.g. if
 * global.fetch is not available on older Node versions, or if a command
 * captures a fetch reference before the patch runs).
 */

const RUNFLIX_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://runflix.name.ng/',
  'Origin': 'https://runflix.name.ng',
};

module.exports = { RUNFLIX_HEADERS };
