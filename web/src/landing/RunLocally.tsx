// SPDX-License-Identifier: Apache-2.0
// "Run it locally": where "Launch app" goes on the public static site. The commands mirror the README's
// "How judges can test it in under 10 minutes" (local devnet only: no token, no wallet, no faucet).
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/anton/400.css';
import './landing.css';
import './run-locally.css';
import { useState } from 'react';
import { FACTS } from './facts';

const STEPS = [
  {
    n: '01',
    title: 'Install and test',
    note: 'Compiles the contract and runs all the tests against the real compiled circuits (about ten seconds).',
    code: ['git clone https://github.com/Im-2/whistle-midnight', 'cd whistle-midnight', 'npm install', 'npm test'],
  },
  {
    n: '02',
    title: 'Start the local devnet and deploy',
    note: 'A Midnight node, indexer and proof server in Docker. The local devnet pre-funds a wallet, so there is no faucet or token. Deploying takes a minute or two.',
    code: ['npm run devnet:up', 'npm run cli -- deploy'],
  },
  {
    n: '03',
    title: 'Run the demo and read the public state',
    note: 'Registers two members, opens a case, files two anonymous reports, flips the case to CORROBORATED, then shows a repeat report being refused.',
    code: ['bash scripts/demo-local.sh', 'npm run cli -- status'],
  },
] as const;

function Code({ lines }: { lines: readonly string[] }) {
  const [done, setDone] = useState(false);
  return (
    <div className="rl__code">
      <pre><code>{lines.join('\n')}</code></pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setDone(true);
            setTimeout(() => setDone(false), 1400);
          } catch {
            /* clipboard unavailable: the text is selectable */
          }
        }}
      >
        {done ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function RunLocally() {
  return (
    <div className="landing rl">
      <header className="rl__top">
        <a className="rl__brand" href="/" aria-label="Whistle home">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 24V8m9 16V8m9 16V8" stroke="currentColor" strokeWidth="3.4" /></svg>
          WHISTLE
        </a>
        <a className="rl__back" href="/">Back to the landing page</a>
      </header>

      <main className="rl__main">
        <p className="rl__kicker">Launch app</p>
        <h1>Run it locally.</h1>
        <p className="rl__lede">
          Whistle builds zero-knowledge proofs and holds keys on the machine you run it on. That machine is the trust
          boundary, so this site does not host a live app: a hosted one would see your secrets. This is the ten-minute path
          to run the real thing on your own computer.
        </p>

        <section className="rl__card" aria-label="Before you start">
          <h2>Before you start</h2>
          <ul>
            <li>Node.js 22 or newer, and Docker running.</li>
            <li>The Compact toolchain, pinned to 0.31.1 (Linux, macOS or WSL2 Ubuntu on Windows):</li>
          </ul>
          <Code lines={['curl --proto \'=https\' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh', 'compact update 0.31.1']} />
        </section>

        <ol className="rl__steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <h2><span>{s.n}</span> {s.title}</h2>
              <p>{s.note}</p>
              <Code lines={s.code} />
            </li>
          ))}
        </ol>

        <section className="rl__card" aria-label="The browser app">
          <h2>Optional: the browser app</h2>
          <p>
            After step 2, one command builds the app and starts a gateway on your own machine. The terminal prints the
            local address to open. You get the Admin, Member and Public screens, the persona switcher, and the encrypted
            Reports inbox.
          </p>
          <Code lines={['npm start']} />
        </section>

        <div className="rl__links">
          <a className="btn btn--solid" href={FACTS.repoUrl} rel="noreferrer">GitHub repo</a>
          <a className="btn btn--ghost" href={FACTS.readmeUrl} rel="noreferrer">README</a>
          <a className="btn btn--ghost" href={FACTS.videoUrl}>Demo video (soon)</a>
        </div>
      </main>

      <footer className="rl__foot">Licensed under Apache-2.0. Built on Midnight. Wave 2, Midnight Buildathon.</footer>
    </div>
  );
}
