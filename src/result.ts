export const RESULT_VERSION = 1;

export interface ResultEnvelopeOptions {
  query?: object;
  source?: object;
}

export function resultEnvelope(kind: string, options: ResultEnvelopeOptions = {}) {
  return {
    kind,
    version: RESULT_VERSION,
    ...(options.query === undefined ? {} : { query: options.query }),
    ...(options.source === undefined ? {} : { source: options.source }),
  };
}
