import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseCommaSeparatedList,
  parseCommaSeparatedPositiveIntegers,
  vendorCacheRequestOptions,
} from '../src/commands/shared-options.js';

test('parseCommaSeparatedList trims entries and drops blanks', () => {
  assert.deepEqual(parseCommaSeparatedList(' a, b ,, c '), ['a', 'b', 'c']);
  assert.equal(parseCommaSeparatedList(undefined), undefined);
});

test('parseCommaSeparatedPositiveIntegers validates each entry', () => {
  assert.deepEqual(parseCommaSeparatedPositiveIntegers(' 1, 20 ,, 300 '), [1, 20, 300]);
  assert.equal(parseCommaSeparatedPositiveIntegers(undefined), undefined);
  assert.throws(() => parseCommaSeparatedPositiveIntegers('1,0'), /Expected positive integer/);
});

test('vendorCacheRequestOptions maps CLI fields to service options', () => {
  assert.deepEqual(vendorCacheRequestOptions({
    refreshVendors: true,
    vendorCacheTtl: 1800,
  }), {
    refreshVendors: true,
    vendorCacheTtlSeconds: 1800,
  });
});
