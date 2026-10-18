// SPDX-License-Identifier: Apache-2.0
import { useLayoutEffect, useRef } from 'react';
import { APP_HREF, FACTS } from './facts';
import { gsap } from './useSmoothScroll';

// Words in `ACCENT` get the muted rose-brown tone once they fill in.
const COPY =
  'People stay silent when speaking up exposes them. Whistle lets a member prove they belong without saying who they are, so the truth can add up without a name attached.';
const ACCENT = new Set(['silent', 'belong', 'name']);

export default function Statement() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      { full: '(min-width: 821px) and (prefers-reduced-motion: no-preference)', light: '(max-width: 820px) and (prefers-reduced-motion: no-preference)' },
      (ctx) => {
        const { full } = ctx.conditions as { full: boolean };
        const q = gsap.utils.selector(root);
        const words = q('.fill-word');
        gsap.set(words, { opacity: 0.14 });

        if (full) {
          // Pinned: words fill, body fades in, then the whole block dissolves (fade + blur + lift) into the next section.
          const tl = gsap.timeline({
            scrollTrigger: { trigger: root.current, start: 'top top', end: '+=170%', pin: true, scrub: 0.6, anticipatePin: 1 },
          });
          // Sequenced relatively so the dissolve can never start before the last word has filled.
          tl.to(words, { opacity: 1, stagger: 0.03, ease: 'none', duration: 0.4 })
            .fromTo(q('.statement__body > *'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.12, duration: 0.3 }, '>0.05')
            .to({}, { duration: 0.5 }) // hold: let the finished statement be read
            .to(q('.statement__inner'), { opacity: 0, filter: 'blur(14px)', y: -50, duration: 0.4, ease: 'power1.in' });
          gsap.fromTo(q('.ghost__word'), { xPercent: 6 }, { xPercent: -34, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: '+=170%', scrub: true } });
        } else {
          gsap.to(words, {
            opacity: 1, stagger: 0.08, ease: 'none',
            scrollTrigger: { trigger: q('.statement__title')[0], start: 'top 85%', end: 'bottom 45%', scrub: 0.4 },
          });
          gsap.from(q('.statement__body > *'), { opacity: 0, y: 24, stagger: 0.1, scrollTrigger: { trigger: q('.statement__body')[0], start: 'top 90%' } });
        }
      },
    );
    return () => mm.revert();
  }, []);

  return (
    <section className="statement" ref={root} aria-label="Why Whistle">
      {/* The ghost word has its own scroll tween above, so it is rendered without Ghost's trigger. */}
      <div className="ghost" aria-hidden="true"><div className="ghost__word">SPEAK UP</div></div>
      <div className="statement__inner">
        <h2 className="statement__title">
          {COPY.split(' ').map((w, i) => (
            <span key={i} className={`fill-word${ACCENT.has(w.replace(/[.,]/g, '')) ? ' fill-word--accent' : ''}`}>{w}{' '}</span>
          ))}
        </h2>
        <div className="statement__body">
          <p>
            Whistle keeps a private set of members. Each one can report a case once, and only a proof that they belong,
            a one-time marker and a hash of the report ever reach the chain.
          </p>
          <div className="statement__cta">
            <a className="btn btn--solid" href={APP_HREF}>Launch app</a>
            <a className="btn btn--ghost" href={FACTS.readmeUrl}>Read the README</a>
          </div>
        </div>
      </div>
    </section>
  );
}
