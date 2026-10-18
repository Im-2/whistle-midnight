// SPDX-License-Identifier: Apache-2.0
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/anton/400.css';
import './landing.css';
import Hero from './Hero';
import { useSmoothScroll } from './useSmoothScroll';

export default function Landing() {
  useSmoothScroll();
  return (
    <main className="landing">
      <Hero />
      <section id="how" className="stub" aria-label="How it works">
        <p>More sections coming next.</p>
      </section>
    </main>
  );
}
