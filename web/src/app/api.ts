// SPDX-License-Identifier: Apache-2.0
// Client for the local gateway (gateway/index.ts), which wraps the API layer in ../../../api.
// Types mirror PublicState / CaseView from api/types.ts.
export type CaseRow = { label: string; caseId: string; threshold: number; reportCount: number; status: 'OPEN' | 'CORROBORATED' };
export type Status = {
  network: string;
  contractAddress: string;
  adminCommitment: string;
  reportsFiled: number;
  nullifiersUsed: number;
  cases: CaseRow[];
};
export type Member = { name: string; commitment: string };

export class ApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError('Cannot reach the Whistle gateway. Is `npm run gateway` running?', 'NETWORK');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, body.code);
  return body as T;
}

const post = <T,>(path: string, data: object) =>
  call<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

export const api = {
  status: () => call<Status>('/api/status'),
  members: () => call<{ members: Member[] }>('/api/members'),
  newMember: (name: string) => post<{ name: string; commitment: string }>('/api/members', { name }),
  register: (who: string) => post<{ commitment: string; txId: string }>('/api/register', { who }),
  openCase: (label: string, threshold: number) => post<{ txId: string }>('/api/cases', { label, threshold }),
  report: (member: string, label: string, text: string) =>
    post<{ reportHash: string; txId: string }>('/api/report', { member, label, text }),
};
