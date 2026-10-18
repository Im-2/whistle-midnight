// SPDX-License-Identifier: Apache-2.0
import { useLayoutEffect, useRef, useState } from 'react';
import Ghost from './Ghost';
import { gsap } from './useSmoothScroll';

const ITEMS = [
  { name: 'Merkle membership', img: '/img/network.webp', w: 1400, h: 1040, pos: '30% 50%',
    text: 'Member commitments sit in a depth-10 HistoricMerkleTree, so a proof built earlier stays valid after new members join.' },
  { name: 'Nullifiers', img: '/img/corridor.webp', w: 1000, h: 1000, pos: '50% 30%',
    text: 'A hash of the member secret and the case is stored when you report. It blocks a second report on that case and cannot be linked back to you.' },
  { name: 'Private witnesses', img: '/img/glass.webp', w: 1000, h: 1000, pos: '50% 50%',
    text: 'Your secret and your Merkle path are witnesses. They are used on your own machine to build the proof and never reach the chain.' },
  { name: 'Public ledger', img: '/img/vein.webp', w: 900, h: 824, pos: '40% 40%',
    text: 'Case status, report counts, nullifiers and report hashes are public, so anyone can check a case without a wallet.' },
] as const;

export default function HoverList() {
  const [active, setActive] = useState(0);
  const root = useRef<HTMLElement>(null);

  // As the dark section rises over this one, this one dims and softens instead of being cut.
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(min-width: 821px) and (prefers-reduced-motion: no-preference)', () => {
      const next = root.current?.nextElementSibling;
      if (!next) return;
      gsap.to(root.current!.querySelector('.list__inner'), {
        opacity: 0.25, filter: 'blur(8px)', scale: 0.98, ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 20%', scrub: true },
      });
    });
    return () => mm.revert();
  }, []);

  return (
    <section id="privacy" className="list" ref={root} aria-label="Building blocks">
      <Ghost text="PRIVATE BY DESIGN" from={0} to={-40} />
      <div className="list__inner">
        <p className="steps__label">What it is built from</p>
        <div className="list__grid">
          <ul className="list__items">
            {ITEMS.map((it, i) => (
              <li key={it.name} className={i === active ? 'is-active' : ''}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  aria-pressed={i === active}
                >
                  <span className="list__num">0{i + 1}</span>
                  <span className="list__name">{it.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="list__reveal" aria-live="polite">
            <div className="list__frame">
              {ITEMS.map((it, i) => (
                <img key={it.img + i} src={it.img} width={it.w} height={it.h} alt="" loading="lazy" decoding="async"
                  className={i === active ? 'is-on' : ''} style={{ objectPosition: it.pos }} />
              ))}
            </div>
            <p className="list__text">{ITEMS[active]!.text}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
