import assert from 'node:assert/strict';
import test from 'node:test';
import {
  actionExecuteEnvelope,
  actionPlanEnvelope,
  executeKindForPlan,
  invalidPlanExecutionResponse,
  noopActionResults,
  queryWithContinueOnError,
  skippedInvalidActionResults,
} from '../src/gear/execution.js';

test('action envelopes share plan and execute contract fields', () => {
  const plan = actionPlanEnvelope('gear-transfer-plan', { itemIds: ['1'] }, { endpoint: 'Destiny2.GetProfile' });
  const execute = actionExecuteEnvelope(plan.kind, queryWithContinueOnError(plan.query, false), plan.source);

  assert.equal(plan.kind, 'gear-transfer-plan');
  assert.equal(plan.version, 1);
  assert.equal(plan.dryRun, true);
  assert.equal(plan.executed, false);
  assert.equal(execute.kind, 'gear-transfer-execute');
  assert.equal(execute.version, 1);
  assert.equal(execute.dryRun, false);
  assert.deepEqual(execute.query, { itemIds: ['1'], continueOnError: false });
});

test('executeKindForPlan derives execute names predictably', () => {
  assert.equal(executeKindForPlan('socket-insert-free-plan'), 'socket-insert-free-execute');
  assert.equal(executeKindForPlan('custom-action'), 'custom-action-execute');
});

test('invalidPlanExecutionResponse blocks invalid plans unless continuing', () => {
  const plan = {
    ok: false,
    ...actionPlanEnvelope('gear-lock-plan', { itemIds: ['1'] }, { endpoint: 'Destiny2.GetProfile' }),
    plans: [{
      ok: false,
      itemId: '1',
      error: { code: 'Nope' },
      actions: [],
    }],
  };

  const blocked = invalidPlanExecutionResponse(plan, {
    error: 'Nothing executed.',
  });
  const continued = invalidPlanExecutionResponse(plan, {
    continueOnError: true,
    error: 'Nothing executed.',
  });

  assert.equal(blocked?.kind, 'gear-lock-execute');
  assert.equal(blocked?.executed, false);
  assert.equal(blocked?.error, 'Nothing executed.');
  assert.equal(continued, undefined);
});

test('skippedInvalidActionResults and noopActionResults summarize item-level plans', () => {
  const plans = [
    {
      ok: false,
      itemId: 'bad',
      error: { code: 'ItemNotFound' },
      actions: [],
    },
    {
      ok: true,
      itemId: 'noop',
      actions: [],
    },
    {
      ok: true,
      itemId: 'execute',
      actions: [{ type: 'transfer' }],
    },
  ];

  assert.deepEqual(skippedInvalidActionResults(plans), [{
    ok: false,
    itemId: 'bad',
    skipped: true,
    error: { code: 'ItemNotFound' },
  }]);
  assert.deepEqual(noopActionResults(plans), [{
    ok: true,
    itemId: 'noop',
    actionCount: 0,
    noop: true,
  }]);
});
