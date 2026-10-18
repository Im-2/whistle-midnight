// SPDX-License-Identifier: Apache-2.0
import { useState } from 'react';
import { useLive } from './hooks';
import { PersonaSwitcher, StatusBar, type PersonaId } from './ui';
import { AdminView, MemberView, PublicView } from './views';

type Tab = 'public' | 'member' | 'admin';

export function App() {
  const live = useLive();
  const [tab, setTab] = useState<Tab>('public');
  const [persona, setPersona] = useState<PersonaId>('admin');

  // Choosing who you act as also takes you to the screen that persona uses.
  const choose = (p: PersonaId) => {
    setPersona(p);
    setTab(p === 'admin' ? 'admin' : 'member');
  };

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

      <StatusBar status={live.status} error={live.error} updatedAt={live.updatedAt} onChanged={live.refresh} />
      <PersonaSwitcher personas={live.personas} value={persona} onChange={choose} />

      <nav role="tablist" aria-label="Screens">
        {tabs.map(([id, text]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {text}
          </button>
        ))}
      </nav>

      <div className="screen" key={tab}>
        {tab === 'public' && <PublicView live={live} />}
        {tab === 'member' && <MemberView live={live} persona={persona} onPersona={choose} />}
        {tab === 'admin' && <AdminView live={live} persona={persona} onPersona={choose} />}
      </div>

      <footer>
        Local demo harness: a gateway on this machine pays fees and builds the proofs, so secrets never leave this computer. Reports are unlinkable on-chain; see the README threat model.
      </footer>
    </main>
  );
}
