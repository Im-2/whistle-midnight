// SPDX-License-Identifier: Apache-2.0
// Numbers shown on the landing page. Each one is real and comes from the repo; none is invented.
// Re-verify before submission: `npm test` (tests) and contract/src/whistle.compact (exported circuits).
export const FACTS = {
  /** `npm test`: 14 simulator tests + 11 API-layer tests + 12 encrypted-report tests. */
  tests: 37,
  /** Exported circuits in contract/src/whistle.compact: registerMember, openCase, fileReport. */
  circuits: 3,
  /** HistoricMerkleTree<10, Bytes<32>>: 2^10 member slots. */
  memberCapacity: 1024,
  repoUrl: 'https://github.com/Im-2/whistle-midnight',
  readmeUrl: 'https://github.com/Im-2/whistle-midnight#readme',
  // Placeholder until the demo video is recorded.
  videoUrl: '#demo-video',
} as const;

/** True in the public static build (VITE_PUBLIC_SITE=true): no app and nothing that calls a gateway. */
export const PUBLIC_SITE = import.meta.env.VITE_PUBLIC_SITE === 'true';

/** Where "Launch app" points: the app on your own machine, or the "Run it locally" page on the public site. */
export const APP_HREF = PUBLIC_SITE ? '/run-locally' : '/app';
