import assert from 'node:assert/strict';
import test from 'node:test';
import { RESULT_VERSION, resultEnvelope } from '../src/result.js';

test('resultEnvelope adds stable kind and version', () => {
  assert.deepEqual(resultEnvelope('inventory-search'), {
    kind: 'inventory-search',
    version: RESULT_VERSION,
  });
});

test('resultEnvelope includes query and source when provided', () => {
  assert.deepEqual(resultEnvelope('vendor-sales', {
    query: { name: 'Festival Flight' },
    source: { endpoint: 'Destiny2.GetVendors' },
  }), {
    kind: 'vendor-sales',
    version: RESULT_VERSION,
    query: { name: 'Festival Flight' },
    source: { endpoint: 'Destiny2.GetVendors' },
  });
});
