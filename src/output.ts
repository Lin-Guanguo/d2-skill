import { currentCommandAuditFilePath } from './audit/command-audit.js';

export function withAuditPath(value: unknown) {
  const auditPath = currentCommandAuditFilePath();
  if (!auditPath || !isRecord(value) || value.audit !== undefined) {
    return value;
  }

  return {
    ...value,
    audit: {
      path: auditPath,
    },
  };
}

function printResult(value: unknown) {
  console.log(JSON.stringify(withAuditPath(value), null, 2));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function serializeError(error: unknown) {
  const result: Record<string, unknown> = {
    ok: false,
    error: getErrorMessage(error),
  };

  if (error instanceof Error && error.name === 'BungieApiError' && isRecord(error)) {
    for (const field of [
      'errorCode',
      'errorStatus',
      'throttleSeconds',
      'httpStatus',
      'endpoint',
    ]) {
      if (error[field] !== undefined) {
        result[field] = error[field];
      }
    }
  }

  return result;
}

export function printError(error: unknown) {
  const serialized = withAuditPath(serializeError(error));
  console.error(JSON.stringify(serialized, null, 2));
}

export async function runCommand(action: () => Promise<unknown>) {
  try {
    const result = await action();
    printResult(result);
  } catch (error) {
    printError(error);
    process.exitCode = 1;
  }
}
