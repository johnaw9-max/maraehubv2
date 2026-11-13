import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { buildRecordsExport } from '../lib/recordsExport';
import { logAudit } from '../lib/audit';

// Settings panel (admin trustees): download one zip holding a copy of all the
// marae's records. Nothing is sent anywhere; the file is built in this browser
// from what the signed-in trustee can already read.
export default function RecordsExport({ maraeName, entityId }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { filename, results }

  async function download() {
    setBusy(true); setError(''); setDone(null); setProgress('Starting…');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { bytes, filename, results } = await buildRecordsExport({
        supabase,
        maraeName,
        exportedBy: user?.email || '',
        onProgress: ({ done: n, total, label }) => setProgress(`${label} (${n} of ${total})`),
      });

      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      const rowCount = results.reduce((n, r) => n + (r.rows || 0), 0);
      // Same record the Finance export keeps; never blocks the download.
      if (user?.email) {
        supabase.from('export_log')
          .insert({ account_email: user.email.toLowerCase(), export_type: 'records_copy_zip', row_count: rowCount })
          .then(() => {}, () => {});
      }
      logAudit({ entityId: entityId || null, action: 'download', resourceType: 'records_export', resourceName: filename, metadata: { rows: rowCount } });
      setDone({ filename, results });
    } catch (e) {
      setError(e?.message || 'Something went wrong. Nothing was downloaded. Please try again.');
    } finally {
      setBusy(false); setProgress('');
    }
  }

  const left = done ? done.results.filter(r => r.status !== 'ok') : [];
  const included = done ? done.results.filter(r => r.status === 'ok') : [];

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, marginBottom: 4, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        A copy of our records
      </div>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        Download everything this marae keeps in MaraeHub (hui and minutes, resolutions, tasks, compliance and its history, assets, bookings, finance and more) as spreadsheets in one file. It is your own copy, held outside MaraeHub, so you always have your records. It is a snapshot from today. It does not include uploaded files, and it holds private information, so keep it somewhere only trustees can reach.
      </p>
      <button className="btn-primary" onClick={download} disabled={busy} style={{ fontSize: 13 }}>
        {busy ? 'Preparing your copy…' : '⬇ Download a copy of our records'}
      </button>
      {busy && progress && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>{progress}</div>}
      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--danger, #b3261e)', marginTop: 10 }}>{error}</div>}
      {done && (
        <div style={{ fontSize: 13, marginTop: 12 }}>
          <div><strong>Downloaded:</strong> {done.filename}</div>
          <div style={{ color: 'var(--text3)', marginTop: 4 }}>
            {included.length} sets of records included. Open the file called READ ME FIRST for what is in it.
          </div>
          {left.length > 0 && (
            <div style={{ color: 'var(--text3)', marginTop: 4 }}>
              Left out: {left.map(r => `${r.label} (${r.reason})`).join('; ')}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
