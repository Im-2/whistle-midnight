// SPDX-License-Identifier: Apache-2.0
import type { CaseSnapshot, ChainDiff } from './api';
import { short } from './hooks';
import { CopyButton } from './ui';

const caseLine = (c: CaseSnapshot) => (c ? `${c.reportCount} of ${c.threshold} reports, ${c.status}` : 'not found');

/**
 * Shown after a report. Every value is read back from the indexer (before and after the transaction)
 * or computed on this machine from the member's own secret. Nothing here is a fixed string about the chain.
 */
export default function ChainPanel({ diff, caseLabel, who }: { diff: ChainDiff; caseLabel: string; who: string }) {
  const { before, after } = diff.case;
  const flipped = before?.status !== 'CORROBORATED' && after?.status === 'CORROBORATED';
  const clean = !diff.checks.secretInDelta && !diff.checks.commitmentInDelta;

  return (
    <section className="chainpanel" aria-label="What the chain sees">
      <header>
        <h3>What the chain sees</h3>
        <p>Read back from the indexer after {who}&rsquo;s report on <strong>{caseLabel}</strong>.</p>
      </header>

      {!diff.indexed && (
        <p className="notice busy" role="status">
          The report was submitted, but the indexer has not shown it yet. Open the Public dashboard in a moment to see it.
        </p>
      )}

      <div className="chainpanel__cols">
        <div>
          <h4>Written to the public ledger</h4>
          <ul>
            <li>
              <span className="tag tag--new">new</span> Nullifier
              {diff.newNullifiers.length === 0 ? (
                <em> not visible yet</em>
              ) : (
                diff.newNullifiers.map((n) => (
                  <span key={n} className="hash">
                    <code title={n}>{short(n, 14, 10)}</code>
                    <CopyButton value={n} />
                  </span>
                ))
              )}
            </li>
            <li>
              <span className="tag tag--new">new</span> Report hash (the text stays off-chain)
              {diff.newReportHashes.map((h) => (
                <span key={h} className="hash">
                  <code title={h}>{short(h, 14, 10)}</code>
                  <CopyButton value={h} />
                </span>
              ))}
            </li>
            <li>
              <span className="tag">changed</span> Case count: <strong>{caseLine(before)}</strong> → <strong>{caseLine(after)}</strong>
              {flipped && <span className="flip"> The case is now CORROBORATED.</span>}
            </li>
            <li>
              <span className="tag">totals</span> Reports on the contract {diff.totals.before.reports} → {diff.totals.after.reports}; nullifiers used {diff.totals.before.nullifiers} → {diff.totals.after.nullifiers}
            </li>
          </ul>
        </div>

        <div>
          <h4>Not on the chain</h4>
          <ul className="checks">
            <li className={!diff.checks.secretInDelta ? 'pass' : 'fail'}>
              {!diff.checks.secretInDelta ? 'Your secret does not appear in anything this report wrote.' : 'Warning: your secret appears in the report data.'}
            </li>
            <li className={!diff.checks.commitmentInDelta ? 'pass' : 'fail'}>
              {!diff.checks.commitmentInDelta ? 'Your member commitment is not in the nullifier or the report hash.' : 'Warning: your commitment appears in the report data.'}
            </li>
            <li className={diff.checks.nullifierIsYours ? 'pass' : ''}>
              {diff.checks.nullifierIsYours
                ? 'The new nullifier is one only you can recompute: this page just did, with your secret, on this machine.'
                : 'Nullifier ownership could not be confirmed yet.'}
            </li>
          </ul>
          <p className="chainpanel__verdict">
            {clean ? 'No identity or secret is on-chain for this report. Observers see that someone in the member set reported, and nothing more.' : 'Check the warnings above.'}
          </p>
        </div>
      </div>
    </section>
  );
}
