// SPDX-License-Identifier: Apache-2.0
import { useCallback, useRef, useState } from 'react';
import Ghost from './Ghost';

// Everything here is a statement about this project's contract and demo. No quotes, logos or invented figures.
const SLIDES = [
  {
    kicker: 'Public', title: 'What anyone can read',
    items: [
      'Each case and its status: OPEN or CORROBORATED',
      'How many reports each case has, against its threshold',
      'Nullifiers: one per member per case, unlinkable to a member',
      'A SHA-256 hash of each report, never the text',
      'The member commitments the admin registered, and so the number of members',
    ],
  },
  {
    kicker: 'Private', title: 'What stays with you',
    items: [
      'Your member secret',
      'Which member filed a given report',
      'Your Merkle path, used only to build the proof',
      'The text of your report: it is encrypted in your browser so only the admin can read it',
      'The admin secret, on the admin’s machine',
    ],
  },
  {
    kicker: 'Honest limits', title: 'What Whistle does not hide',
    items: [
      'The admin knows who received which commitment at registration.',
      'If you lose your secret there is no recovery.',
      'This demo runs a gateway on your own machine because that is where the trust boundary is. A hosted gateway would see your secret.',
      'Wallet and network metadata sit outside the zero-knowledge proof.',
      'A small member set means a small anonymity set.',
      'The admin holding a case key can read every report for it, and the words themselves can identify their author.',
    ],
  },
] as const;

export default function Chain() {
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  const go = useCallback((d: number) => setI((v) => (v + d + SLIDES.length) % SLIDES.length), []);

  return (
    <section
      id="chain"
      className="chain"
      aria-roledescription="carousel"
      aria-label="What the chain sees"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
      onTouchStart={(e) => (touch.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0]!.clientX - touch.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <Ghost text="THE CHAIN" from={0} to={-36} light />
      <div className="chain__inner">
        <header className="chain__head">
          <h2>What the chain sees</h2>
          <p>A plain account of what is public, what stays private, and where the limits are.</p>
        </header>

        <div className="chain__stage">
          <button type="button" className="chain__nav" onClick={() => go(-1)} aria-label="Previous slide">Prev</button>
          <div className="chain__viewport">
            <div className="chain__track" style={{ transform: `translateX(-${i * 100}%)` }}>
              {SLIDES.map((s, n) => (
                <article className="chain__slide" key={s.kicker} aria-hidden={n !== i} aria-label={`${n + 1} of ${SLIDES.length}`}>
                  <span className="chain__kicker">{String(n + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')} &middot; {s.kicker}</span>
                  <h3>{s.title}</h3>
                  <ul>{s.items.map((t) => <li key={t}>{t}</li>)}</ul>
                </article>
              ))}
            </div>
          </div>
          <button type="button" className="chain__nav" onClick={() => go(1)} aria-label="Next slide">Next</button>
        </div>

        <div className="chain__dots" role="tablist" aria-label="Choose slide">
          {SLIDES.map((s, n) => (
            <button key={s.kicker} role="tab" aria-selected={n === i} aria-label={s.kicker} className={n === i ? 'is-on' : ''} onClick={() => setI(n)} />
          ))}
        </div>
      </div>
    </section>
  );
}
