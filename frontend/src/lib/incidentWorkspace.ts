import api from '@/lib/api';

export type RcaMethod = 'FIVE_WHYS' | 'FISHBONE';

export interface IncidentWorkspaceAnalysis {
  id: string;
  status?: string;
  method?: string;
  isValidated?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
}

export function normalizeRcaMethod(method?: string | null): RcaMethod {
  return method === 'FIVE_WHYS' ? 'FIVE_WHYS' : 'FISHBONE';
}

export function getPrimaryRcaAnalysis(
  analyses: IncidentWorkspaceAnalysis[] = []
): IncidentWorkspaceAnalysis | null {
  return analyses.find((rca) => !rca.isValidated) || analyses[0] || null;
}

export async function ensureRcaWorkspaceForIncident(
  incidentId: string,
  existingAnalyses: IncidentWorkspaceAnalysis[] = [],
  preferredMethod: RcaMethod = 'FISHBONE'
): Promise<IncidentWorkspaceAnalysis> {
  const existingAnalysis = getPrimaryRcaAnalysis(existingAnalyses);
  if (existingAnalysis) {
    return existingAnalysis;
  }

  const analysesResponse = await api.get(`/rca/incidents/${incidentId}`);
  const serverAnalyses = Array.isArray(analysesResponse.data?.data)
    ? analysesResponse.data.data
    : [];
  const serverAnalysis = getPrimaryRcaAnalysis(serverAnalyses);
  if (serverAnalysis) {
    return serverAnalysis;
  }

  const createResponse = await api.post(`/rca/incidents/${incidentId}`, {
    method: preferredMethod,
  });

  return createResponse.data.data;
}
