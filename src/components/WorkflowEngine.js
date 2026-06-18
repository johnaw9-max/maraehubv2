import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { startWorkflow, getActiveWorkflows, getWorkflowTemplates } from '../lib/workflowEngine';

export default function WorkflowEngine() {
  const [templates, setTemplates] = useState([]);
  const [instances, setInstances] = useState([]);
  const [instanceTasks, setInstanceTasks] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [tplRes, instRes] = await Promise.all([
      supabase.from('workflow_templates').select('*').order('name'),
      supabase.from('workflow_instances').select('*').eq('status', 'active').order('created_at', { ascending: false }),
    ]);
    const tpls = tplRes.data || [];
    const insts = instRes.data || [];
    setTemplates(tpls);
    setInstances(insts);

    if (insts.length > 0) {
      const ids = insts.map(i => i.id);
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, workflow_instance_id')
        .in('workflow_instance_id', ids);
      const grouped = {};
      (tasks || []).forEach(t => {
        if (!grouped[t.workflow_instance_id]) grouped[t.workflow_instance_id] = [];
        grouped[t.workflow_instance_id].push(t);
      });
      setInstanceTasks(grouped);
    }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function handleStart(e) {
    e.preventDefault();
    if (!selectedTemplate || !workflowName.trim()) return;
    setStarting(true);
    setStartError('');
    try {
      await startWorkflow(selectedTemplate, workflowName.trim());
      setWorkflowName('');
      await load();
    } catch (err) {
      setStartError(err.message || 'Could not start workflow');
    }
    setStarting(false);
  }

  function progressFor(instanceId) {
    const tasks = instanceTasks[instanceId] || [];
    if (tasks.length === 0) return { pct: 0, done: 0, total: 0, next: null };
    const done = tasks.filter(t => ['completed', 'cancelled'].includes(t.status)).length;
    const next = tasks.find(t => !['completed', 'cancelled'].includes(t.status)) || null;
    return { pct: Math.round((done / tasks.length) * 100), done, total: tasks.length, next };
  }

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div>
      {/* ── START NEW WORKFLOW ─────────────────────────────────────────────── */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header" style={{ marginBottom: 16 }}>
          <div className="panel-title">Start New Workflow</div>
        </div>

        {templates.length === 0 && !loading ? (
          <div className="empty-state">
            <div className="emoji">📋</div>
            <div>No workflow templates yet</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              Add templates to the workflow_templates table to get started.
            </div>
          </div>
        ) : (
          <form onSubmit={handleStart}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Template
              </label>
              <select
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                style={{ width: '100%', maxWidth: 360, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--text1)' }}
              >
                <option value="">— Select a template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {selectedTemplate && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 280px' }}>
                  <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                    Workflow Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AGM 2026 Prep"
                    value={workflowName}
                    onChange={e => setWorkflowName(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--text1)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={starting || !workflowName.trim()}
                    style={{ padding: '9px 22px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (starting || !workflowName.trim()) ? 0.6 : 1 }}
                  >
                    {starting ? 'Starting…' : 'Start Workflow'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
        {startError && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#faeae7', borderRadius: 8, fontSize: 13, color: 'var(--danger)' }}>
            {startError}
          </div>
        )}
        {selectedTemplate && templates.find(t => t.id === selectedTemplate)?.description && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
            {templates.find(t => t.id === selectedTemplate).description}
          </div>
        )}
      </div>

      {/* ── ACTIVE WORKFLOWS ──────────────────────────────────────────────── */}
      <div className="panel">
        <div className="panel-header" style={{ marginBottom: 16 }}>
          <div className="panel-title">Active Workflows</div>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{instances.length} active</span>
        </div>

        {loading ? (
          <div className="loading">Loading workflows…</div>
        ) : instances.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">⚙️</div>
            <div>No active workflows</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              Start a workflow above to track progress step by step.
            </div>
          </div>
        ) : (
          instances.map(inst => {
            const { pct, done, total, next } = progressFor(inst.id);
            const tplName = templates.find(t => t.id === inst.template_id)?.name || '';
            return (
              <div key={inst.id} style={{ padding: 16, background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--cream2)', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text1)', marginBottom: 2 }}>{inst.name}</div>
                    {tplName && (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{tplName} · Started {formatDate(inst.created_at)}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: pct === 100 ? 'var(--brand)' : 'var(--text2)', background: pct === 100 ? '#e8f4ef' : 'var(--cream2)', padding: '3px 10px', borderRadius: 20 }}>
                    {done}/{total} steps
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 6, background: 'var(--cream2)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--brand)' : 'var(--brand-light)', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>

                {/* Next task */}
                {next ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>Next:</span>
                    <span style={{ fontSize: 13, color: 'var(--text2)', background: '#fdf4e8', border: '1px solid #e8c880', borderRadius: 6, padding: '3px 10px' }}>
                      {next.title}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--brand)', fontWeight: 500 }}>✅ All steps complete</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
