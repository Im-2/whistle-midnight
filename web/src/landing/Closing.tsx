// SPDX-License-Identifier: Apache-2.0
import { useLayoutEffect, useRef } from 'react';
import { FACTS } from './facts';
import { gsap } from './useSmoothScroll';

const COLS = 5;
const ROWS = 3;
const IMGS = [
  { src: '/img/glass.webp', w: 1000, h: 1000 },
  { src: '/img/network.webp', w: 1400, h: 1040 },
  { src: '/img/vein.webp', w: 900, h: 824 },
  { src: '/img/corridor.webp', w: 1000, h: 1000 },
  { src: '/img/hero.webp', w: 660, h: 440 },
] as const;
const POS = ['20% 30%', '70% 60%', '50% 20%', '30% 80%', '80% 40%', '50% 50%'];

const tiles = Array.from({ length: COLS * ROWS }, (_, n) => ({
  n,
  img: IMGS[(n * 2 + Math.floor(n / COLS)) % IMGS.length]!,
  pos: POS[n % POS.length]!,
  // Checkerboard: these tiles stay as images; the others fade to empty charcoal.
  keep: (Math.floor(n / COLS) + (n % COLS)) % 2 === 0,
}));

export default function Closing() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(min-width: 821px) and (prefers-reduced-motion: no-preference)', () => {
      const q = gsap.utils.selector(root);
      const el = root.current!;
      el.classList.add('closing--pinned'); // pinned layout: grey stage with the full mosaic
      gsap.set(q('.closing__cta > *'), { opacity: 0, y: 28 });
      // Pinned: a full mosaic on grey collapses to a checkerboard on charcoal while the call to action appears beside it.
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: { trigger: root.current, start: 'top top', end: '+=150%', pin: true, scrub: 0.7, anticipatePin: 1 },
      });
      tl.to(root.current, { backgroundColor: '#1f1f1f', duration: 1 }, 0)
        .to(q('.closing__grid'), { scale: 0.62, xPercent: 34, duration: 1 }, 0)
        .to(q('.tile:not(.tile--keep)'), { opacity: 0, scale: 0.8, stagger: 0.03, duration: 0.7 }, 0.15)
        .to(q('.closing__cta > *'), { opacity: 1, y: 0, stagger: 0.1, duration: 0.5 }, 0.55);
      return () => el.classList.remove('closing--pinned');
    });
    return () => mm.revert();
  }, []);

  return (
    <section className="closing" ref={root} aria-label="Try Whistle">
      <div className="closing__grid" aria-hidden="true">
        {tiles.map((t) => (
          <div key={t.n} className={`tile${t.keep ? ' tile--keep' : ''}`}>
            <img src={t.img.src} width={t.img.w} height={t.img.h} alt="" loading="lazy" decoding="async" style={{ objectPosition: t.pos }} />
          </div>
        ))}
      </div>
      <div className="closing__cta">
        <h2>Try it on your own machine.</h2>
        <p>
          Whistle runs against a local Midnight devnet. Launch the app to register a member, open a case and file an
          anonymous report, or read how it is built.
        </p>
        <div className="closing__links">
          <a className="btn btn--solid-light" href="/app">Launch app</a>
          <a className="btn btn--line" href={FACTS.repoUrl} rel="noreferrer">GitHub repo</a>
          <a className="btn btn--line" href={FACTS.readmeUrl} rel="noreferrer">README</a>
          <a className="btn btn--line" href={FACTS.videoUrl}>Demo video (soon)</a>
        </div>
      </div>
    </section>
  );
}
