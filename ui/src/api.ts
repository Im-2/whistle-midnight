// SPDX-License-Identifier: Apache-2.0
export type CaseRow = { label: string; threshold: number; reportCount: number; status: 'OPEN' | 'CORROBORATED' };
export type Status = { network: string; contract: string; admin: string; reports: number; nullifiers: number; cases: CaseRow[] };
export type Member = { name: string; commitment: string };

/** Turn contract assertion messages into plain language. */
const FRIENDLY: Record<string, string> = {
  'Already reported this case': 'This member has already reported this case. Each member can report a case once.',
  'Not a verified member': 'That identity is not in the verified member set. Ask the admin to register it first.',
  'Unknown case': 'That case does not exist yet. Ask the admin to open it.',
  'Not admin': 'Only the admin can do this.',
  'Case already exists': 'A case with that label already exists.',
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error('Cannot reach the Whistle server. Is `npm run server` running?');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw: string = body.error ?? `Request failed (${res.status})`;
    throw new Error(FRIENDLY[raw] ?? raw);
  }
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
