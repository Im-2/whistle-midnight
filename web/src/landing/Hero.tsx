// SPDX-License-Identifier: Apache-2.0
import { useLayoutEffect, useRef } from 'react';
import { APP_HREF, FACTS } from './facts';
import { gsap, prefersReducedMotion } from './useSmoothScroll';

export function Nav() {
  const el = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from('.nav > *', { opacity: 0, y: -12, duration: 0.9, stagger: 0.08, delay: 0.6, ease: 'power3.out' });
    }, el);
    return () => ctx.revert();
  }, []);
  return (
    <header className="nav" ref={el}>
      <a className="nav__mark" href="/" aria-label="Whistle home">
        <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M7 24V8m9 16V8m9 16V8" stroke="currentColor" strokeWidth="3.4" strokeLinecap="butt" />
        </svg>
        <span>WHISTLE</span>
      </a>
      <nav className="nav__links" aria-label="Sections">
        <a href="#how">How it works</a>
        <a href="#privacy">Privacy</a>
        <a href="#chain">What the chain sees</a>
        <a href={FACTS.repoUrl} rel="noreferrer">Source</a>
      </nav>
      <a className="btn btn--small" href={APP_HREF}>LAUNCH APP</a>
    </header>
  );
}

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero__img', { opacity: 0, scale: 1.28, filter: 'blur(26px)', duration: 1.8, ease: 'power2.out' }, 0)
        .from('.hero__line > span', { yPercent: 110, duration: 1, stagger: 0.12 }, 0.35)
        .from('.hero__cta > *, .hero__caption, .hero__stat, .hero__inset', { opacity: 0, y: 18, duration: 0.9, stagger: 0.07 }, 0.9);
    }, root);
    // As you scroll away, the whole hero dissolves (fade + blur + lift) into the next section.
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to(root.current, { opacity: 0.0, filter: 'blur(14px)', y: -60, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: '75% top', scrub: true } });
    });
    return () => {
      mm.revert();
      ctx.revert();
    };
  }, []);

  return (
    <section className="hero" ref={root} aria-label="Whistle">
      <div className="hero__media" aria-hidden="true">
        <img className="hero__img" src="/img/hero.webp" width={660} height={440} alt="" {...{ fetchpriority: 'high' }} decoding="async" />
        <div className="hero__veil" />
      </div>

      <div className="hero__main">
      <h1 className="hero__title">
        <span className="hero__line"><span>Report</span></span>
        <span className="hero__line"><span>without being</span></span>
        <span className="hero__line"><span>identified.</span></span>
      </h1>

      <div className="hero__cta">
        <a className="btn btn--solid" href={APP_HREF}>Launch app</a>
        <a className="btn btn--ghost" href="#how">How it works</a>
      </div>
      </div>

      <p className="hero__caption">
        A verified member proves they belong to the group without saying which member they are.
        When enough different members report the same case, it is confirmed on-chain.
      </p>

      <div className="hero__stat glass">
        <strong>{FACTS.tests}</strong>
        <span>tests passing against the real compiled circuits of the Whistle contract</span>
      </div>

      <figure className="hero__inset">
        <img src="/img/glass.webp" width={1000} height={1000} alt="" loading="eager" decoding="async" />
        <figcaption>Zero-knowledge proof</figcaption>
      </figure>

      <i className="corner corner--l" aria-hidden="true" />
      <i className="corner corner--r" aria-hidden="true" />
    </section>
  );
}
