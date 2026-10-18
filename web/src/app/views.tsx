// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState } from 'react';
import { encryptReport } from '../../../api/report-crypto';
import { api, type Inbox, type ReportResult } from './api';
import ChainPanel from './ChainPanel';
import { short, useAction, useAgo, type Live } from './hooks';
import { CopyButton, Notice, type PersonaId } from './ui';

const BUSY = 'Generating proof, this takes a moment…';

/* ------------------------------------------------------------------ public dashboard */

export function PublicView({ live }: { live: Live }) {
  const { status, error, loading, updatedAt, refresh } = live;
  const ago = useAgo(updatedAt);

  if (loading && !status) {
    return (
      <section aria-busy="true">
        <div className="skeleton skeleton--facts" />
        <div className="skeleton" />
        <div className="skeleton" />
      </section>
    );
  }
  if (error && !status) {
    return (
      <section>
        <p className="notice err" role="alert">{error}</p>
        <button type="button" className="btn-inline" onClick={() => void refresh()}>Try again</button>
      </section>
    );
  }
  if (!status) return null;

  return (
    <section>
      <p className="lede">
        Anyone can read this without a wallet. It shows case status and counts only. Nothing here says who reported.
      </p>
      {error && <p className="notice err" role="alert">{error} Showing the last data we had{ago !== null ? ` (${ago}s old)` : ''}.</p>}

      {!status.deployed ? (
        <div className="empty">
          <strong>No contract is deployed yet.</strong>
          <span>Use “Deploy contract” in the bar above. It takes a minute or two the first time.</span>
        </div>
      ) : (
        <>
          <dl className="facts">
            <div><dt>Network</dt><dd>{status.networkLabel}</dd></div>
            <div><dt>Reports filed</dt><dd>{status.reportsFiled}</dd></div>
            <div><dt>Distinct member reports</dt><dd>{status.nullifiersUsed}</dd></div>
            <div><dt>Cases</dt><dd>{status.cases.length}</dd></div>
          </dl>

          {status.cases.length === 0 ? (
            <div className="empty">
              <strong>No cases yet.</strong>
              <span>Switch to Admin and open one. A case needs a threshold of distinct member reports.</span>
            </div>
          ) : (
            <ul className="cases">
              {status.cases.map((c) => (
                <li key={c.caseId} className={c.status === 'CORROBORATED' ? 'done' : ''}>
                  <div className="row">
                    <strong>{c.label}</strong>
                    <span className={`badge ${c.status.toLowerCase()}`}>{c.status}</span>
                  </div>
                  <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={c.threshold} aria-valuenow={Math.min(c.reportCount, c.threshold)} aria-label={`${c.label} progress`}>
                    <div style={{ width: `${Math.min(100, (c.reportCount / c.threshold) * 100)}%` }} />
                  </div>
                  <small>
                    {c.reportCount} of {c.threshold} distinct members have reported
                    {c.status === 'OPEN' && c.threshold > c.reportCount ? `. ${c.threshold - c.reportCount} more to corroborate.` : '.'}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------- member */

export function MemberView({ live, persona, onPersona }: { live: Live; persona: PersonaId; onPersona: (p: PersonaId) => void }) {
  const { status, personas, refresh } = live;
  const file = useAction();
  const create = useAction();
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [made, setMade] = useState<{ name: string; commitment: string } | null>(null);
  const [result, setResult] = useState<{ r: ReportResult; caseLabel: string; who: string } | null>(null);

  if (persona === 'admin') {
    return (
      <section>
        <div className="empty">
          <strong>You are acting as Admin.</strong>
          <span>Members file reports. Pick a member to continue.</span>
          <span className="empty__actions">
            {(['alice', 'bob', 'carol'] as const).map((id) => (
              <button key={id} type="button" className="btn-inline" onClick={() => onPersona(id)}>Act as {id[0]!.toUpperCase() + id.slice(1)}</button>
            ))}
          </span>
        </div>
      </section>
    );
  }

  const me = personas?.members.find((m) => m.id === persona);
  const cases = status?.deployed ? status.cases : [];
  const chosen = cases.find((c) => c.label === label);

  return (
    <section>
      <div className="card">
        <h2>{me?.label ?? persona}&rsquo;s identity</h2>
        <p>
          The secret for this identity lives on this machine and never reaches the chain. The admin only ever sees the commitment.
        </p>
        {me && (
          <dl className="idrow">
            <div>
              <dt>Commitment</dt>
              <dd><code title={me.commitment}>{short(me.commitment, 14, 10)}</code> <CopyButton value={me.commitment} /></dd>
            </div>
            <div>
              <dt>Member set</dt>
              <dd>
                <span className={`badge ${me.registered ? 'corroborated' : 'open'}`}>{me.registered === null ? 'checking…' : me.registered ? 'Registered member' : 'Not registered yet'}</span>
              </dd>
            </div>
          </dl>
        )}
        {me && me.registered === false && (
          <p className="hint">The admin has not registered {me.label} yet. Switch to Admin and register them, or try filing anyway to see the chain refuse.</p>
        )}
      </div>

      <div className="card">
        <h2>File an anonymous report</h2>
        <p>
          You prove &ldquo;I am a registered member&rdquo; in zero knowledge. The chain records a one-time marker for this case and a hash of your report, never your identity.
        </p>
        {!status?.deployed ? (
          <div className="empty"><strong>No contract is deployed yet.</strong><span>Use “Deploy contract” in the bar above.</span></div>
        ) : cases.length === 0 ? (
          <div className="empty"><strong>No cases to report on yet.</strong><span>Switch to Admin and open a case first.</span></div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setResult(null);
              const r = await file.run(
                async () => {
                  // Encrypted here, in the browser, to this case's public key. The plaintext never goes to the gateway or the chain.
                  const { publicKey } = await api.caseKey(label);
                  const { ciphertext } = await encryptReport(publicKey, text.trim(), label);
                  return api.report(persona, label, ciphertext);
                },
                () => 'Your report was encrypted and sent. The admin can read it. Nobody can tell who sent it.',
              );
              if (r) {
                setResult({ r, caseLabel: label, who: me?.label ?? persona });
                setText('');
              }
              await refresh();
            }}
          >
            <label>
              Case
              <select value={label} onChange={(e) => setLabel(e.target.value)} required>
                <option value="">Choose a case…</option>
                {cases.map((c) => (
                  <option key={c.caseId} value={c.label}>
                    {c.label} ({c.reportCount}/{c.threshold}{c.status === 'CORROBORATED' ? ', corroborated' : ''}){c.encrypted === false ? ' - no encryption key' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              What you saw (encrypted to the admin before it is sent; only a hash goes on-chain)
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} required maxLength={2000} placeholder="Describe what you saw. It is encrypted in this page, so only the admin can read it." />
            </label>
            <button disabled={file.busy || !label || !text.trim() || chosen?.encrypted === false}>File report</button>
            {chosen?.encrypted === false && <p className="hint">This case was opened without an encryption key (for example from the CLI), so reports cannot be delivered. Ask the admin to open it from the app.</p>}
            <p className="hint">Be careful what you write: the words themselves can identify their author.</p>
            {chosen?.status === 'CORROBORATED' && <p className="hint">This case is already corroborated, but more members can still add their report.</p>}
          </form>
        )}
        <Notice flash={file.flash} busy={file.busy} busyText={BUSY} />
      </div>

      {result && <ChainPanel diff={result.r.chain} caseLabel={result.caseLabel} who={result.who} />}

      <details className="card advanced">
        <summary>Advanced: create another identity</summary>
        <p>Generates a new secret on this machine and gives you the commitment to hand to the admin. To file reports as it, use the CLI.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await create.run(() => api.newMember(name.trim()), (r) => `Identity “${r.name}” created.`);
            if (r) {
              setMade(r);
              setName('');
              await refresh();
            }
          }}
        >
          <label>
            Handle (stays on this machine)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. dave" required maxLength={32} pattern="[A-Za-z0-9_\-]{1,32}" />
          </label>
          <button disabled={create.busy || !name.trim()}>Create identity</button>
        </form>
        <Notice flash={create.flash} busy={create.busy} busyText="Generating your secret…" />
        {made && (
          <p className="mono">
            Commitment to give the admin:<br />
            <code>{made.commitment}</code>
          </p>
        )}
      </details>
    </section>
  );
}

/* -------------------------------------------------------------------------- admin */

/** Makes the demo shortcut explicit: the real protection is cryptographic, not this page. */
function DemoBanner() {
  return (
    <aside className="demo-banner" role="note">
      <strong>Demo mode</strong>
      <span>
        In a real deployment this console is a separate app, reachable only with the admin key. Reports are encrypted to the
        case key, so opening this page without the key reveals nothing.
      </span>
    </aside>
  );
}

export function AdminView({ live, persona, onPersona }: { live: Live; persona: PersonaId; onPersona: (p: PersonaId) => void }) {
  const { status, personas, refresh } = live;
  const reg = useAction();
  const open = useAction();
  const [pasted, setPasted] = useState('');
  const [registering, setRegistering] = useState<string | null>(null);
  const [label, setLabel] = useState('case-001');
  const [threshold, setThreshold] = useState(3);

  if (persona !== 'admin') {
    return (
      <section>
        <DemoBanner />
        <div className="empty">
          <strong>Only the admin can do this.</strong>
          <span>Registering members and opening cases needs the admin identity.</span>
          <span className="empty__actions">
            <button type="button" className="btn-inline" onClick={() => onPersona('admin')}>Switch to Admin</button>
          </span>
        </div>
      </section>
    );
  }
  if (!status?.deployed) {
    return (
      <section>
        <DemoBanner />
        <div className="empty"><strong>No contract is deployed yet.</strong><span>Use “Deploy contract” in the bar above, then come back here.</span></div>
      </section>
    );
  }

  const doRegister = async (who: string, display: string) => {
    setRegistering(who);
    await reg.run(() => api.register(who), () => `Registered ${display}.`);
    setRegistering(null);
    await refresh();
  };

  return (
    <section>
      <DemoBanner />
      <div className="card">
        <h2>Register members</h2>
        <p>The admin adds a member&rsquo;s commitment to the on-chain member tree. The member&rsquo;s secret never leaves them.</p>
        <ul className="people">
          {personas?.members.map((m) => (
            <li key={m.id}>
              <div>
                <strong>{m.label}</strong>
                <code title={m.commitment}>{short(m.commitment, 12, 8)}</code>
              </div>
              <span className={`badge ${m.registered ? 'corroborated' : 'open'}`}>{m.registered === null ? '…' : m.registered ? 'registered' : 'not registered'}</span>
              <button type="button" className="btn-inline" disabled={reg.busy || m.registered === true} onClick={() => void doRegister(m.id, m.label)}>
                {registering === m.id && reg.busy ? 'Registering…' : m.registered ? 'Registered' : 'Register'}
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await doRegister(pasted.trim(), short(pasted.trim()));
            setPasted('');
          }}
        >
          <label>
            Or paste a commitment (64 hex characters)
            <input value={pasted} onChange={(e) => setPasted(e.target.value)} pattern="[0-9a-fA-F]{64}" placeholder="optional" />
          </label>
          <button disabled={reg.busy || !pasted.trim()}>Register commitment</button>
        </form>
        <Notice flash={reg.flash} busy={reg.busy} busyText={BUSY} />
      </div>

      <div className="card">
        <h2>Open a case</h2>
        <p>The case flips to CORROBORATED once this many <em>distinct</em> verified members have reported it.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = label.trim();
            const r = await open.run(() => api.openCase(name, threshold), () => `Case “${name}” is open. Its encryption key stays on this machine, so only you can read the reports.`);
            if (r) setLabel('');
            await refresh();
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
        <Notice flash={open.flash} busy={open.busy} busyText={BUSY} />
      </div>

      <ReportsInbox live={live} />
    </section>
  );
}

/* ----------------------------------------------------------------- reports inbox */

const STATUS_TEXT: Record<string, string> = {
  verified: 'Matches its on-chain hash',
  unconfirmed: 'Waiting for the chain to show its hash',
  tampered: 'Altered: does not match its on-chain hash',
  unreadable: 'Cannot be read',
};

/** The admin's Reports inbox: decrypted reports for one case, in arrival order, with no sender information. */
function ReportsInbox({ live }: { live: Live }) {
  const cases = live.status?.deployed ? live.status.cases : [];
  const [label, setLabel] = useState('');
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const current = label || cases[0]?.label || '';
  const count = cases.find((c) => c.label === current)?.reportCount ?? 0;

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    const load = async () => {
      try {
        const i = await api.inbox(current);
        if (!cancelled) {
          setInbox(i);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the inbox.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    setLoading(true);
    void load();
    return () => {
      cancelled = true;
    };
    // Reload when the chain's report count for this case changes.
  }, [current, count]);

  return (
    <div className="card inbox">
      <h2>Reports inbox</h2>
      <p>
        Reports are decrypted here with the case&rsquo;s private key, which stays on this machine. Nothing in this list says who sent a report.
      </p>
      {cases.length === 0 ? (
        <div className="empty"><strong>No cases yet.</strong><span>Open a case above. Reports for it will appear here.</span></div>
      ) : (
        <>
          <label>
            Case
            <select value={current} onChange={(e) => setLabel(e.target.value)}>
              {cases.map((c) => (
                <option key={c.caseId} value={c.label}>{c.label} ({c.reportCount} on-chain)</option>
              ))}
            </select>
          </label>
          {error && <p className="notice err" role="alert">{error}</p>}
          {loading && !inbox && <div className="skeleton" aria-busy="true" />}
          {inbox && !inbox.hasKey && (
            <p className="notice err" role="alert">
              The private key for this case is not on this machine, so its reports cannot be decrypted here. Reports stay encrypted; the key is kept in the .whistle folder of the machine that opened the case.
            </p>
          )}
          {inbox && inbox.hasKey && inbox.reports.length === 0 && (
            <div className="empty"><strong>No reports delivered yet.</strong><span>Reports appear here once a member files one on this case.</span></div>
          )}
          {inbox && inbox.reports.length > 0 && (
            <ol className="inbox__list">
              {inbox.reports.map((r) => (
                <li key={r.order} className={r.status === 'verified' ? '' : 'inbox__warn'}>
                  <div className="inbox__meta">
                    <strong>Report {r.order}</strong>
                    <span>{current}</span>
                    <time dateTime={r.filedAt}>{new Date(r.filedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time>
                    <span className={`badge ${r.status === 'verified' ? 'corroborated' : 'open'}`}>{STATUS_TEXT[r.status]}</span>
                  </div>
                  {r.text !== null ? <p className="inbox__text">{r.text}</p> : <p className="hint">The text is withheld because it cannot be trusted or read.</p>}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
