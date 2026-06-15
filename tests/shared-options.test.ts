import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCommaSeparatedList } from '../src/commands/shared-options.js';

test('parseCommaSeparatedList trims entries and drops blanks', () => {
  assert.deepEqual(parseCommaSeparatedList(' a, b ,, c '), ['a', 'b', 'c']);
  assert.equal(parseCommaSeparatedList(undefined), undefined);
});
