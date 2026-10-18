// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from 'react';
import { api, type Member, type Status } from './api';

type Tab = 'public' | 'member' | 'admin';
type Flash = { kind: 'ok' | 'err'; text: string } | null;

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

/** Runs an async action with loading + success/error feedback. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const run = async <T,>(fn: () => Promise<T>, ok: (r: T) => string): Promise<T | undefined> => {
    setBusy(true);
    setFlash(null);
    try {
      const r = await fn();
      setFlash({ kind: 'ok', text: ok(r) });
      return r;
    } catch (e) {
      setFlash({ kind: 'err', text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  };
  return { busy, flash, run };
}

function Notice({ flash, busy, busyText }: { flash: Flash; busy: boolean; busyText: string }) {
  if (busy)
    return (
      <p className="notice busy" role="status">
        <span className="spinner" /> {busyText}
      </p>
    );
  if (!flash) return null;
  return (
    <p className={`notice ${flash.kind}`} role={flash.kind === 'err' ? 'alert' : 'status'}>
      {flash.text}
    </p>
  );
}

function usePolled() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const refresh = useCallback(async () => {
    try {
      setStatus(await api.status());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
    try {
      setMembers((await api.members()).members);
    } catch {
      /* members list is a convenience */
    }
  }, []);
  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [refresh]);
  return { status, error, members, refresh };
}

function PublicView({ status, error }: { status: Status | null; error: string | null }) {
  if (error && !status) return <p className="notice err">{error}</p>;
  if (!status) return <p className="notice busy"><span className="spinner" /> Reading the chain…</p>;
  return (
    <section>
      <p className="lede">
        Anyone can read this without a wallet. It shows case status and counts only. Nothing here says who reported.
      </p>
      <dl className="facts">
        <div><dt>Network</dt><dd>{status.network}</dd></div>
        <div><dt>Contract</dt><dd title={status.contractAddress}>{short(status.contractAddress)}</dd></div>
        <div><dt>Reports filed</dt><dd>{status.reportsFiled}</dd></div>
        <div><dt>Distinct members who reported</dt><dd>{status.nullifiersUsed}</dd></div>
      </dl>
      {status.cases.length === 0 ? (
        <p className="empty">No cases yet. The admin opens one on the Admin tab.</p>
      ) : (
        <ul className="cases">
          {status.cases.map((c) => (
            <li key={c.label} className={c.status === 'CORROBORATED' ? 'done' : ''}>
              <div className="row">
                <strong>{c.label}</strong>
                <span className={`badge ${c.status.toLowerCase()}`}>{c.status}</span>
              </div>
              <div className="bar" aria-hidden>
                <div style={{ width: `${Math.min(100, (c.reportCount / c.threshold) * 100)}%` }} />
              </div>
              <small>
                {c.reportCount} of {c.threshold} verified members reported
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MemberView({ status, members, refresh }: { status: Status | null; members: Member[]; refresh: () => void }) {
  const create = useAction();
  const file = useAction();
  const [name, setName] = useState('');
  const [made, setMade] = useState<{ name: string; commitment: string } | null>(null);
  const [member, setMember] = useState('');
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const cases = status?.cases ?? [];

  return (
    <section>
      <div className="card">
        <h2>1. Create your identity</h2>
        <p>
          Your secret is generated locally and never leaves this machine. You give the admin only the <em>commitment</em>,
          which reveals nothing about the secret.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await create.run(() => api.newMember(name.trim()), (r) => `Identity "${r.name}" created.`);
            if (r) {
              setMade(r);
              setMember(r.name);
              setName('');
              refresh();
            }
          }}
        >
          <label>
            Your handle (stays on this machine)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. alice" required maxLength={32} />
          </label>
          <button disabled={create.busy || !name.trim()}>Create identity</button>
        </form>
        <Notice flash={create.flash} busy={create.busy} busyText="Generating your secret…" />
        {made && (
          <p className="mono">
            Give this commitment to the admin:<br />
            <code>{made.commitment}</code>
          </p>
        )}
      </div>

      <div className="card">
        <h2>2. File an anonymous report</h2>
        <p>
          You prove "I am a registered member" in zero knowledge. The chain records a one-time marker for this case and a
          hash of your report, never your identity.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await file.run(
              () => api.report(member, label, text),
              (r) => `Report filed anonymously. Content hash ${short(r.reportHash)}.`,
            );
            if (r) {
              setText('');
              refresh();
            }
          }}
        >
          <label>
            Identity
            <select value={member} onChange={(e) => setMember(e.target.value)} required>
              <option value="">Choose…</option>
              {members.map((m) => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
          </label>
          <label>
            Case
            <select value={label} onChange={(e) => setLabel(e.target.value)} required>
              <option value="">Choose…</option>
              {cases.map((c) => (
                <option key={c.label} value={c.label}>{c.label} ({c.reportCount}/{c.threshold})</option>
              ))}
            </select>
          </label>
          <label>
            What you saw (only a hash of this goes on-chain)
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} required maxLength={2000} />
          </label>
          <button disabled={file.busy || !member || !label || !text.trim()}>File report</button>
        </form>
        <Notice flash={file.flash} busy={file.busy} busyText="Generating the zero-knowledge proof and submitting. This can take up to a minute." />
      </div>
    </section>
  );
}

function AdminView({ members, refresh }: { members: Member[]; refresh: () => void }) {
  const reg = useAction();
  const open = useAction();
  const [who, setWho] = useState('');
  const [pasted, setPasted] = useState('');
  const [label, setLabel] = useState('');
  const [threshold, setThreshold] = useState(2);

  return (
    <section>
      <div className="card">
        <h2>Register a member</h2>
        <p>Choose a locally created identity, or paste a commitment a member sent you.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await reg.run(() => api.register((pasted.trim() || who)), (r) => `Registered ${short(r.commitment)}.`);
            if (r) {
              setPasted('');
              refresh();
            }
          }}
        >
          <label>
            Local identity
            <select value={who} onChange={(e) => setWho(e.target.value)} disabled={!!pasted.trim()}>
              <option value="">Choose…</option>
              {members.map((m) => (
                <option key={m.name} value={m.name}>{m.name} ({short(m.commitment)})</option>
              ))}
            </select>
          </label>
          <label>
            …or paste a commitment (64 hex characters)
            <input value={pasted} onChange={(e) => setPasted(e.target.value)} pattern="[0-9a-fA-F]{64}|" placeholder="optional" />
          </label>
          <button disabled={reg.busy || (!who && !pasted.trim())}>Register member</button>
        </form>
        <Notice flash={reg.flash} busy={reg.busy} busyText="Proving you are the admin and registering the member…" />
      </div>

      <div className="card">
        <h2>Open a case</h2>
        <p>The case flips to CORROBORATED once this many <em>distinct</em> verified members have reported it.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await open.run(() => api.openCase(label.trim(), threshold), () => `Case "${label.trim()}" is open.`);
            if (r) {
              setLabel('');
              refresh();
            }
          }}
        >
          <label>
            Case label
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. case-001" required maxLength={32} />
          </label>
          <label>
            Reports needed
            <input type="number" min={1} max={1000} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} required />
          </label>
          <button disabled={open.busy || !label.trim() || threshold < 1}>Open case</button>
        </form>
        <Notice flash={open.flash} busy={open.busy} busyText="Proving you are the admin and opening the case…" />
      </div>
    </section>
  );
}

export function App() {
  const [tab, setTab] = useState<Tab>('public');
  const { status, error, members, refresh } = usePolled();
  const tabs: [Tab, string][] = [['public', 'Public dashboard'], ['member', 'Member'], ['admin', 'Admin']];
  return (
    <main>
      <header>
        <h1>
          <a className="brand" href="/" aria-label="Whistle home">
            <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 24V8m9 16V8m9 16V8" stroke="currentColor" strokeWidth="3.4" /></svg>
            WHISTLE
          </a>
        </h1>
        <p>Verified-anonymous reporting, corroborated on Midnight.</p>
      </header>
      <nav role="tablist">
        {tabs.map(([id, text]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {text}
          </button>
        ))}
      </nav>
      {tab === 'public' && <PublicView status={status} error={error} />}
      {tab === 'member' && <MemberView status={status} members={members} refresh={refresh} />}
      {tab === 'admin' && <AdminView members={members} refresh={refresh} />}
      <footer>
        Local demo harness: a server on this machine pays fees and runs the proofs. Reports are unlinkable on-chain; see the README threat model.
      </footer>
    </main>
  );
}
