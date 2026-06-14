export type ClaimStatus = 'confirmed' | 'candidate' | 'rejected' | 'unknown';
export type ClaimConfidence = 'high' | 'medium' | 'low';

export interface ReportClaim {
  status: ClaimStatus;
  confidence: ClaimConfidence;
  evidence: Record<string, unknown>;
}

export function claim(
  status: ClaimStatus,
  confidence: ClaimConfidence,
  evidence: Record<string, unknown>,
): ReportClaim {
  return {
    status,
    confidence,
    evidence,
  };
}
