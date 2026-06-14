import { BungieApiError } from '../bungie/http-client.js';

export function waitBetweenGearActions(ms = 120) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function formatExecutionError(error: unknown) {
  if (error instanceof BungieApiError) {
    return {
      message: error.message,
      errorCode: error.errorCode,
      errorStatus: error.errorStatus,
      throttleSeconds: error.throttleSeconds,
      httpStatus: error.httpStatus,
    };
  }

  return {
    message: error instanceof Error ? error.message : String(error),
  };
}
