// SPDX-License-Identifier: Apache-2.0
import { useLayoutEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from './useSmoothScroll';

/**
 * Giant, low-opacity condensed word that drifts horizontally behind a section as it scrolls.
 * `from`/`to` are percentages of the word's own width. Static when reduced motion is requested.
 */
export default function Ghost({ text, from = 8, to = -28, light = false }: { text: string; from?: number; to?: number; light?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (prefersReducedMotion() || !el.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.current,
        { xPercent: from },
        { xPercent: to, ease: 'none', scrollTrigger: { trigger: el.current!.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } },
      );
    });
    return () => ctx.revert();
  }, [from, to]);
  return (
    <div className={`ghost${light ? ' ghost--light' : ''}`} aria-hidden="true">
      <div ref={el} className="ghost__word">{text}</div>
    </div>
  );
}
