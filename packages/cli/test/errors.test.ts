import assert from 'node:assert/strict';
import test from 'node:test';

import { describeError } from '../src/errors.js';

function fetchFailed(code: string): Error {
  return Object.assign(new Error('fetch failed'), { cause: { code } });
}

test('describeError explains a bare fetch failure with its cause', () => {
  const msg = describeError(fetchFailed('ENOTFOUND'), {});
  assert.match(msg, /Network request failed \(ENOTFOUND\)/);
  assert.doesNotMatch(msg, /NODE_USE_ENV_PROXY/);
});

test('describeError suggests NODE_USE_ENV_PROXY when a proxy is set but ignored', () => {
  const msg = describeError(fetchFailed('ECONNREFUSED'), { HTTPS_PROXY: 'http://proxy:8080' });
  assert.match(msg, /NODE_USE_ENV_PROXY=1/);
  const already = describeError(fetchFailed('ECONNREFUSED'), {
    HTTPS_PROXY: 'http://proxy:8080',
    NODE_USE_ENV_PROXY: '1',
  });
  assert.doesNotMatch(already, /NODE_USE_ENV_PROXY/);
});

test('describeError passes other errors through', () => {
  assert.equal(describeError(new Error('GROQ_API_KEY not set. Run: saymd setup'), {}), 'GROQ_API_KEY not set. Run: saymd setup');
});
