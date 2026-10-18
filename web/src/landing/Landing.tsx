// SPDX-License-Identifier: Apache-2.0
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/anton/400.css';
import './landing.css';
import './sections.css';
import { useEffect } from 'react';
import Chain from './Chain';
import Closing from './Closing';
import Footer from './Footer';
import Hero, { Nav } from './Hero';
import HoverList from './HoverList';
import Statement from './Statement';
import Steps from './Steps';
import { ScrollTrigger, useSmoothScroll } from './useSmoothScroll';

export default function Landing() {
  useSmoothScroll();

  // Pinned sections depend on final layout: recompute once fonts and images have settled.
  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', refresh);
    void document.fonts?.ready.then(refresh);
    return () => window.removeEventListener('load', refresh);
  }, []);

  return (
    <div className="landing">
      <Nav />
      <main>
        <Hero />
        <Statement />
        <Steps />
        <HoverList />
        <Chain />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}
