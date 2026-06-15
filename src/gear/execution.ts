import { formatBungieError } from '../bungie/errors.js';
import { resultEnvelope } from '../result.js';

export interface PlannedActionResult {
  ok: boolean;
  itemId: string;
  error?: unknown;
  actions: readonly unknown[];
}

export interface ActionExecutionResult {
  ok: boolean;
  itemId: string;
  [key: string]: unknown;
}

interface PlanResult {
  kind: string;
  query: object;
  source: object;
  plans: readonly PlannedActionResult[];
}

interface ActionPlanEnvelope {
  kind: string;
  version: number;
  query: object;
  source: object;
  dryRun: true;
  executed: false;
}

interface ActionExecuteEnvelope {
  kind: string;
  version: number;
  query: object;
  source: object;
  dryRun: false;
}

export function waitBetweenGearActions(ms = 120) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function formatExecutionError(error: unknown) {
  return formatBungieError(error);
}

export function actionPlanEnvelope(kind: string, query: object, source: object): ActionPlanEnvelope {
  return {
    ...resultEnvelope(kind, { query, source }),
    dryRun: true,
    executed: false,
  } as ActionPlanEnvelope;
}

export function executeKindForPlan(kind: string) {
  return kind.endsWith('-plan') ? `${kind.slice(0, -'-plan'.length)}-execute` : `${kind}-execute`;
}

export function actionExecuteEnvelope(
  planKind: string,
  query: object,
  source: object,
): ActionExecuteEnvelope {
  return {
    ...resultEnvelope(executeKindForPlan(planKind), { query, source }),
    dryRun: false,
  } as ActionExecuteEnvelope;
}

export function queryWithContinueOnError(query: object, continueOnError: boolean | undefined) {
  return {
    ...query,
    continueOnError: continueOnError ?? false,
  };
}

export function invalidPlanExecutionResponse<TPlan extends PlanResult>(
  plan: TPlan,
  options: {
    continueOnError?: boolean;
    error: string;
  },
) {
  const invalidPlans = plan.plans.filter((itemPlan) => !itemPlan.ok);
  if (!invalidPlans.length || options.continueOnError) {
    return undefined;
  }

  return {
    ...plan,
    ...actionExecuteEnvelope(
      plan.kind,
      queryWithContinueOnError(plan.query, options.continueOnError),
      plan.source,
    ),
    ok: false,
    executed: false,
    error: options.error,
  };
}

export function skippedInvalidActionResults(plans: readonly PlannedActionResult[]): ActionExecutionResult[] {
  return plans.flatMap((itemPlan) =>
    itemPlan.ok
      ? []
      : [{
        ok: false,
        itemId: itemPlan.itemId,
        skipped: true,
        error: itemPlan.error,
      }],
  );
}

export function noopActionResults(plans: readonly PlannedActionResult[]): ActionExecutionResult[] {
  return plans.flatMap((itemPlan) =>
    itemPlan.ok && itemPlan.actions.length === 0
      ? [{
        ok: true,
        itemId: itemPlan.itemId,
        actionCount: 0,
        noop: true,
      }]
      : [],
  );
}
