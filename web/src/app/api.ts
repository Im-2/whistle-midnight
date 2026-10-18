// SPDX-License-Identifier: Apache-2.0
// Client for the local gateway (gateway/index.ts), which wraps the API layer in ../../../api.
export type CaseRow = { label: string; caseId: string; threshold: number; reportCount: number; status: 'OPEN' | 'CORROBORATED'; /** true when reports for this case can be delivered encrypted */ encrypted?: boolean };

export type Status =
  | { deployed: false; network: string; networkLabel: string; cases: CaseRow[] }
  | {
      deployed: true;
      network: string;
      networkLabel: string;
      contractAddress: string;
      adminCommitment: string;
      reportsFiled: number;
      nullifiersUsed: number;
      nullifiers: string[];
      reportHashes: string[];
      cases: CaseRow[];
    };

export type Persona = { id: string; label: string; commitment: string; registered: boolean | null };
export type Personas = { admin: { id: 'admin'; label: string; hasSecret: boolean }; members: Persona[] };
export type Member = { name: string; commitment: string };

export type CaseSnapshot = { label: string; reportCount: number; threshold: number; status: 'OPEN' | 'CORROBORATED' } | null;
/** What a report changed on the public ledger, from real indexer reads before and after the transaction. */
export type ChainDiff = {
  indexed: boolean;
  case: { before: CaseSnapshot; after: CaseSnapshot };
  totals: { before: { reports: number; nullifiers: number }; after: { reports: number; nullifiers: number } };
  newNullifiers: string[];
  newReportHashes: string[];
  checks: { nullifierIsYours: boolean; secretInDelta: boolean; commitmentInDelta: boolean };
};
export type InboxEntry = { order: number; filedAt: string; status: 'verified' | 'unconfirmed' | 'tampered' | 'unreadable'; text: string | null };
/** The admin's inbox for a case. By design it carries no sender information. */
export type Inbox = { caseLabel: string; hasKey: boolean; reports: InboxEntry[] };
export type ReportResult = { txId: string; blockHeight: number; reportHash: string; chain: ChainDiff };

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
    throw new ApiError('Cannot reach the Whistle gateway. Is it running? (npm run gateway)', 'NETWORK');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, body.code);
  return body as T;
}

const post = <T,>(path: string, data: object = {}) =>
  call<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

export const api = {
  status: () => call<Status>('/api/status'),
  personas: () => call<Personas>('/api/personas'),
  deploy: () => post<{ contractAddress: string; adminCommitment: string }>('/api/deploy'),
  newMember: (name: string) => post<Member>('/api/members', { name }),
  register: (who: string) => post<{ commitment: string; txId: string }>('/api/register', { who }),
  openCase: (label: string, threshold: number) => post<{ txId: string }>('/api/cases', { label, threshold }),
  caseKey: (label: string) => call<{ label: string; publicKey: string }>(`/api/case-key?label=${encodeURIComponent(label)}`),
  inbox: (label: string) => call<Inbox>(`/api/inbox?label=${encodeURIComponent(label)}`),
  /** `ciphertext` is the report already encrypted to the case key in the browser; plaintext is never sent. */
  report: (member: string, label: string, ciphertext: string) => post<ReportResult>('/api/report', { member, label, ciphertext }),
};
