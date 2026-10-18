// SPDX-License-Identifier: Apache-2.0
import { APP_HREF, FACTS } from './facts';

export default function Footer() {
  return (
    <footer className="foot">
      <div className="foot__cols">
        <div>
          <p className="foot__brand">WHISTLE</p>
          <p>Verified-anonymous reporting with on-chain corroboration.</p>
        </div>
        <div>
          <h4>Project</h4>
          <a href={FACTS.repoUrl} rel="noreferrer">GitHub</a>
          <a href={FACTS.readmeUrl} rel="noreferrer">README</a>
          <a href={FACTS.videoUrl} target="_blank" rel="noopener noreferrer">Watch the demo</a>
          <a href={APP_HREF}>Launch app</a>
        </div>
        <div>
          <h4>Sections</h4>
          <a href="#how">How it works</a>
          <a href="#privacy">Privacy</a>
          <a href="#chain">What the chain sees</a>
        </div>
      </div>
      <p className="foot__fine">
        Licensed under Apache-2.0. Built on Midnight. Wave 2, Midnight Buildathon.
      </p>
    </footer>
  );
}
