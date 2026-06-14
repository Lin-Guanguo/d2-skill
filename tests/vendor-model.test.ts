import assert from 'node:assert/strict';
import test from 'node:test';
import { VendorItemStatus } from 'bungie-api-ts/destiny2';
import {
  saleMatchesQuery,
  saleStatusFlags,
  selectVendorSales,
  summarizeCostAffordability,
} from '../src/vendors/vendor-model.js';

test('saleStatusFlags derives common vendor status bits', () => {
  assert.equal(saleStatusFlags(VendorItemStatus.Success).success, true);

  const flags = saleStatusFlags(VendorItemStatus.NoFunds | VendorItemStatus.NoUnlock);

  assert.equal(flags.success, false);
  assert.equal(flags.noFunds, true);
  assert.equal(flags.noUnlock, true);
  assert.equal(flags.notAvailable, false);
});

test('summarizeCostAffordability compares required and available quantities', () => {
  assert.equal(summarizeCostAffordability({
    itemHash: 1,
    quantity: 5,
    hasConditionalVisibility: false,
  }, 7).affordable, true);
  assert.equal(summarizeCostAffordability({
    itemHash: 1,
    quantity: 5,
    hasConditionalVisibility: false,
  }, 3).affordable, false);
});

test('saleMatchesQuery filters by sold item and cost item', () => {
  const sale = {
    itemHash: 10,
    itemName: 'Solstice Weapon Engram',
    vendorHash: 20,
    vendorName: 'Tenet of Bravery',
    costs: [{ itemHash: 30, name: 'Legendary Marks', quantity: 2 }],
    statusPurchasable: true,
    affordable: true,
  };

  assert.equal(saleMatchesQuery(sale, { name: 'weapon', costName: 'marks' }), true);
  assert.equal(saleMatchesQuery(sale, { itemHash: 11 }), false);
  assert.equal(saleMatchesQuery(sale, { affordable: true }), true);
});

test('selectVendorSales filters and limits results', () => {
  const sales = [
    {
      itemHash: 1,
      itemName: 'Alpha',
      vendorHash: 100,
      costs: [],
      statusPurchasable: true,
      affordable: true,
    },
    {
      itemHash: 2,
      itemName: 'Alphabet',
      vendorHash: 100,
      costs: [],
      statusPurchasable: true,
      affordable: true,
    },
  ];

  const result = selectVendorSales(sales, { name: 'alpha', limit: 1 }, 50);

  assert.equal(result.totalMatched, 2);
  assert.equal(result.count, 1);
  assert.equal(result.truncated, true);
});
