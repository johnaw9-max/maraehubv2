import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAiDrafting } from '../lib/useAiDrafting';
import { functionErrorMessage } from '../lib/functionErrorMessage';
import { buildAskContext, buildAskSources } from '../lib/complianceCheck';

// "Ask" box: a trustee asks a question and gets an answer drawn only from the marae's own
// compliance items and their recorded sources. The answer is a draft; trustees decide.
function niceDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AskCompliance({ items, sourcesByKey }) {
  const [ai, setAi] = useState({ id: null, enabled: false });
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('marae_settings').select('id, ai_drafting_enabled').maybeSingle()
      .then(({ data }) => { if (data) setAi({ id: data.id, enabled: !!data.ai_drafting_enabled }); });
  }, []);
  const { ConsentModal, requestConsent } = useAiDrafting(ai.id, ai.enabled);

  async function ask() {
    const q = question.trim();
    if (!q || loading) return;
    if (q.length > 500) { setError('Please keep the question under 500 characters.'); return; }
    if (!(await requestConsent())) return;
    setLoading(true); setError(''); setAnswer(''); setSources([]);
    const context = buildAskContext(items, sourcesByKey);
    const { data, error: err } = await supabase.functions.invoke('ask-compliance', { body: { question: q, context } });
    setLoading(false);
    if (err) {
      const msg = await functionErrorMessage(err, 'Could not reach the AI service');
      setError(msg === 'ai_auth_or_billing' ? "The AI service isn't available right now. The founder has been notified." : msg);
      return;
    }
    if (data?.error) { setError(data.error); return; }
    setAnswer(data?.answer || '');
    setSources(buildAskSources(data?.items, items, sourcesByKey));
  }

  return (
    <div data-testid="ask-compliance" style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
      <ConsentModal />
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Ask a question</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
        Answers come only from your compliance items and their recorded sources. If there is no source, it will say so. It is a draft for the trustees to decide.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          aria-label="Ask a compliance question"
          value={question}
          maxLength={500}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') ask(); }}
          placeholder="For example: do we need a written evacuation procedure?"
          style={{ flex: '1 1 260px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
        />
        <button className="btn btn-primary" onClick={ask} disabled={loading || !question.trim()}>{loading ? 'Asking…' : 'Ask'}</button>
      </div>
      {error && <div role="alert" style={{ marginTop: 10, fontSize: 13, color: 'var(--danger, #b00020)' }}>{error}</div>}
      {answer && <div data-testid="ask-answer" style={{ marginTop: 10, fontSize: 14, whiteSpace: 'pre-wrap' }}>{answer}</div>}
      {answer && (() => {
        const labels = [...new Set(sources.map(x => x.classLabel))];
        const seen = new Map();
        sources.forEach(x => x.sources.forEach(src => { if (!seen.has(src.name)) seen.set(src.name, src); }));
        const list = [...seen.values()];
        const dates = [...new Set(list.map(x => x.checkedOn).filter(Boolean))];
        const oneDate = dates.length === 1 ? niceDate(dates[0]) : '';
        return (
          <div data-testid="ask-sources" style={{ marginTop: 10, fontSize: 13, color: 'var(--text2)' }}>
            {list.length === 0 ? (
              <span>No source recorded in MaraeHub for this answer.</span>
            ) : (
              <span>
                {labels.length > 0 && <span style={{ textTransform: 'capitalize' }}>{labels.join(' / ')}. </span>}
                Sources:{' '}
                {list.map((src, i) => (
                  <span key={src.name}>
                    {i > 0 ? ' · ' : ''}
                    {src.url ? <a href={src.url} target="_blank" rel="noopener noreferrer">{src.name}</a> : src.name}
                    {!oneDate && src.checkedOn ? ` (checked ${niceDate(src.checkedOn)})` : ''}
                  </span>
                ))}
                {oneDate ? `. Checked ${oneDate}.` : ''}
              </span>
            )}
          </div>
        );
      })()}
      {answer && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>Draft for the trustees to decide.</div>}
    </div>
  );
}
