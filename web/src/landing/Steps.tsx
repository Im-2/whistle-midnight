// SPDX-License-Identifier: Apache-2.0
import { useLayoutEffect, useRef } from 'react';
import Ghost from './Ghost';
import { gsap } from './useSmoothScroll';

const STEPS = [
  {
    n: '01', title: 'Join', tag: 'Admin', img: '/img/glass.webp', w: 1000, h: 1000, pos: '50% 50%',
    line: 'The admin registers a commitment, not a name.',
    body: 'You generate a secret on your own machine and hand the admin only its commitment. They add it to an on-chain Merkle tree of members and never see your secret.',
  },
  {
    n: '02', title: 'Report', tag: 'Member', img: '/img/corridor.webp', w: 1000, h: 1000, pos: '50% 40%',
    line: 'Prove you belong. Reveal nothing else.',
    body: 'A zero-knowledge proof shows your commitment is in the tree. A nullifier made from your secret and the case allows one report per member per case. Only a hash of the report goes on-chain.',
  },
  {
    n: '03', title: 'Corroborate', tag: 'Public ledger', img: '/img/vein.webp', w: 900, h: 824, pos: '50% 50%',
    line: 'Enough different members, and the case flips.',
    body: 'Each accepted report raises a public counter. When N distinct members have reported, the contract sets the case to CORROBORATED. Nobody learns who they were.',
  },
] as const;

export default function Steps() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      { full: '(min-width: 821px) and (prefers-reduced-motion: no-preference)', light: '(max-width: 820px) and (prefers-reduced-motion: no-preference)' },
      (ctx) => {
        const { full } = ctx.conditions as { full: boolean };
        const q = gsap.utils.selector(root);
        const cards = q('.card');
        if (full) {
          // Pinned stage: each card slides up over the previous one, which recedes (scale, dim, blur).
          gsap.set(cards.slice(1), { yPercent: 105 });
          const tl = gsap.timeline({
            defaults: { ease: 'power2.inOut' },
            scrollTrigger: { trigger: q('.steps__stage')[0], start: 'top top', end: '+=260%', pin: true, scrub: 0.7, anticipatePin: 1 },
          });
          cards.slice(1).forEach((card, i) => {
            const prev = cards[i];
            tl.to(card, { yPercent: 0, duration: 1 }, i)
              .to(prev, { scale: 0.93, opacity: 0.55, filter: 'blur(6px)', duration: 1 }, i);
          });
          tl.to(q('.steps__stage'), { opacity: 0, filter: 'blur(12px)', duration: 0.5, ease: 'power1.in' }, '>+0.1');
        } else {
          cards.forEach((card) => gsap.from(card, { opacity: 0, y: 40, scrollTrigger: { trigger: card, start: 'top 88%' } }));
        }
      },
    );
    return () => mm.revert();
  }, []);

  return (
    <section id="how" className="steps" ref={root} aria-label="How it works">
      <Ghost text="HOW IT WORKS" from={4} to={-38} />
      <div className="steps__stage">
        <p className="steps__label">How it works</p>
        <div className="steps__cards">
          {STEPS.map((s) => (
            <article className="card" key={s.n}>
              <img className="card__img" src={s.img} width={s.w} height={s.h} alt="" loading="lazy" decoding="async" style={{ objectPosition: s.pos }} />
              <div className="card__shade" />
              <header className="card__head">
                <h3>{s.n} {s.title}</h3>
                <span>Step {s.n} / 03</span>
              </header>
              <div className="card__foot">
                <p className="card__line">{s.line}</p>
                <p className="card__body">{s.body}</p>
                <span className="card__tag">{s.tag}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
