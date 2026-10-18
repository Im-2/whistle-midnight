// SPDX-License-Identifier: Apache-2.0
// Small shared pieces: notices, copy button, status bar, persona switcher.
import { useEffect, useState } from 'react';
import { api, type Personas, type Status } from './api';
import { short, useAction, useAgo, type Flash } from './hooks';

export type PersonaId = 'admin' | 'alice' | 'bob' | 'carol';

export function Notice({ flash, busy, busyText }: { flash: Flash; busy: boolean; busyText: string }) {
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

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard unavailable: the full value is also in the title attribute */
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export function StatusBar({ status, error, updatedAt, onChanged }: { status: Status | null; error: string | null; updatedAt: number | null; onChanged: () => Promise<void> }) {
  const deploy = useAction();
  // A success note is only useful for a moment; errors stay until the next attempt.
  useEffect(() => {
    if (deploy.flash?.kind !== 'ok') return;
    const t = setTimeout(deploy.clear, 6000);
    return () => clearTimeout(t);
  }, [deploy.flash]);
  const ago = useAgo(updatedAt);
  const label = status?.networkLabel ?? 'Local devnet';
  const live = !error && status !== null;
  return (
    <section className="statusbar" aria-label="Network status">
      <span className={`pill ${live ? 'pill--live' : 'pill--down'}`}>
        <i aria-hidden="true" />
        {label}
        {!live && ' · not reachable'}
      </span>

      {status?.deployed ? (
        <span className="statusbar__contract">
          Contract <code title={status.contractAddress}>{short(status.contractAddress, 10, 8)}</code>
          <CopyButton value={status.contractAddress} />
        </span>
      ) : status ? (
        <span className="statusbar__contract">
          No contract deployed yet.{' '}
          <button
            type="button"
            className="btn-inline"
            disabled={deploy.busy}
            onClick={async () => {
              await deploy.run(() => api.deploy(), (r) => `Deployed ${short(r.contractAddress)}.`);
              await onChanged();
            }}
          >
            Deploy contract
          </button>
        </span>
      ) : (
        <span className="statusbar__contract">Connecting…</span>
      )}

      <span className="statusbar__live" aria-live="off">
        {ago === null ? '' : ago < 2 ? 'Updated just now' : `Updated ${ago}s ago`}
      </span>
      {(deploy.busy || deploy.flash) && (
        <div className="statusbar__note">
          <Notice flash={deploy.flash} busy={deploy.busy} busyText="Deploying the contract and generating its proof. This takes a minute or two." />
        </div>
      )}
    </section>
  );
}

const ORDER: PersonaId[] = ['admin', 'alice', 'bob', 'carol'];

export function PersonaSwitcher({ personas, value, onChange }: { personas: Personas | null; value: PersonaId; onChange: (p: PersonaId) => void }) {
  const info = (id: PersonaId) => (id === 'admin' ? null : personas?.members.find((m) => m.id === id) ?? null);
  return (
    <section className="personas" aria-label="Who are you acting as">
      <span className="personas__label">Acting as</span>
      <div className="personas__row" role="radiogroup" aria-label="Persona">
        {ORDER.map((id) => {
          const m = info(id);
          const label = id === 'admin' ? 'Admin' : m?.label ?? id;
          return (
            <button key={id} type="button" role="radio" aria-checked={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>
              <span>{label}</span>
              {id !== 'admin' && m && (
                <small className={m.registered ? 'ok' : ''}>{m.registered === null ? '…' : m.registered ? 'registered' : 'not registered'}</small>
              )}
              {id === 'admin' && <small>opens cases</small>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
