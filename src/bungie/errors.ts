import { BungieApiError } from './http-client.js';

export function formatBungieError(error: unknown) {
  if (error instanceof BungieApiError) {
    return {
      message: error.message,
      errorCode: error.errorCode,
      errorStatus: error.errorStatus,
      throttleSeconds: error.throttleSeconds,
      httpStatus: error.httpStatus,
      endpoint: error.endpoint,
    };
  }

  return {
    message: error instanceof Error ? error.message : String(error),
  };
}
