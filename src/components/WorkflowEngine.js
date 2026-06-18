import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { startWorkflow, getActiveWorkflows } from '../lib/workflowEngine';

export default function WorkflowEngine() {
  const [templates, setTemplates] = useState([]);
  const [instances, setInstances] = useState([]);
  const [instanceTasks, setInstanceTasks] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [loading, setLoading] = useState(true);

  // Template management state
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [templateSteps, setTemplateSteps] = useState({});
  const [editingStep, setEditingStep] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [savingStep, setSavingStep] = useState(null);
  const [deletingStep, setDeletingStep] = useState(null);
  const [addingStepFor, setAddingStepFor] = useState(null);
  const [addForm, setAddForm] = useState({ title: '', description: '' });
  const [savingNewStep, setSavingNewStep] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [tplRes, insts] = await Promise.all([
      supabase.from('workflow_templates').select('*').order('name'),
      getActiveWorkflows(),
    ]);
    console.log('[WorkflowEngine] getActiveWorkflows result:', insts);
    setTemplates(tplRes.data || []);
    setInstances(insts);

    const grouped = {};
    insts.forEach(inst => {
      grouped[inst.id] = inst.tasks || [];
    });
    setInstanceTasks(grouped);
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function handleStart(e) {
    e.preventDefault();
    if (!selectedTemplate || !workflowName.trim()) return;
    setStarting(true);
    setStartError('');
    try {
      await startWorkflow(selectedTemplate, {
        name: workflowName.trim(),
        entity_name: sourceName.trim() || null,
        trigger_type: triggerType || null,
      });
      setWorkflowName('');
      setSourceName('');
      setTriggerType('');
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

  // ── Template management helpers ───────────────────────────────────────────

  async function loadSteps(templateId) {
    const { data } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('template_id', templateId)
      .order('step_order');
    setTemplateSteps(prev => ({ ...prev, [templateId]: data || [] }));
  }

  function toggleTemplate(templateId) {
    if (expandedTemplate === templateId) {
      setExpandedTemplate(null);
      setEditingStep(null);
    } else {
      setExpandedTemplate(templateId);
      setEditingStep(null);
      if (!templateSteps[templateId]) loadSteps(templateId);
    }
  }

  async function moveStep(templateId, step, direction) {
    const steps = templateSteps[templateId] || [];
    const idx = steps.findIndex(s => s.id === step.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= steps.length) return;

    const other = steps[swapIdx];
    await Promise.all([
      supabase.from('workflow_steps').update({ step_order: other.step_order }).eq('id', step.id),
      supabase.from('workflow_steps').update({ step_order: step.step_order }).eq('id', other.id),
    ]);

    const updated = steps.map(s => {
      if (s.id === step.id) return { ...s, step_order: other.step_order };
      if (s.id === other.id) return { ...s, step_order: step.step_order };
      return s;
    }).sort((a, b) => a.step_order - b.step_order);
    setTemplateSteps(prev => ({ ...prev, [templateId]: updated }));
  }

  function startEdit(step) {
    setEditingStep(step.id);
    setEditForm({ title: step.title, description: step.description || '' });
  }

  function cancelEdit() {
    setEditingStep(null);
    setEditForm({ title: '', description: '' });
  }

  async function deleteStep(templateId, step) {
    if (!window.confirm(`Delete step "${step.title}"? This cannot be undone.`)) return;
    setDeletingStep(step.id);
    await supabase.from('workflow_steps').delete().eq('id', step.id);
    setTemplateSteps(prev => ({
      ...prev,
      [templateId]: (prev[templateId] || []).filter(s => s.id !== step.id),
    }));
    setDeletingStep(null);
  }

  function startAddStep(templateId) {
    setAddingStepFor(templateId);
    setAddForm({ title: '', description: '' });
    setEditingStep(null);
  }

  function cancelAddStep() {
    setAddingStepFor(null);
    setAddForm({ title: '', description: '' });
  }

  async function saveNewStep(templateId) {
    if (!addForm.title.trim()) return;
    setSavingNewStep(true);
    const steps = templateSteps[templateId] || [];
    const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) + 1 : 1;
    const { data, error } = await supabase
      .from('workflow_steps')
      .insert({ template_id: templateId, title: addForm.title.trim(), description: addForm.description.trim() || null, step_order: nextOrder })
      .select()
      .single();
    if (!error && data) {
      setTemplateSteps(prev => ({
        ...prev,
        [templateId]: [...(prev[templateId] || []), data],
      }));
    }
    setSavingNewStep(false);
    setAddingStepFor(null);
    setAddForm({ title: '', description: '' });
  }

  async function saveEdit(templateId, step) {
    if (!editForm.title.trim()) return;
    setSavingStep(step.id);
    await supabase
      .from('workflow_steps')
      .update({ title: editForm.title.trim(), description: editForm.description.trim() || null })
      .eq('id', step.id);
    setTemplateSteps(prev => ({
      ...prev,
      [templateId]: (prev[templateId] || []).map(s =>
        s.id === step.id
          ? { ...s, title: editForm.title.trim(), description: editForm.description.trim() || null }
          : s
      ),
    }));
    setSavingStep(null);
    setEditingStep(null);
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
              <div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
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
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '2 1 200px' }}>
                    <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                      Source Record <span style={{ fontWeight: 400, fontStyle: 'italic' }}>(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ute — WOF due 15 Jul"
                      value={sourceName}
                      onChange={e => setSourceName(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--text1)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <label style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                      Trigger Type <span style={{ fontWeight: 400, fontStyle: 'italic' }}>(optional)</span>
                    </label>
                    <select
                      value={triggerType}
                      onChange={e => setTriggerType(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, background: 'var(--surface)', color: 'var(--text1)' }}
                    >
                      <option value="">— Select —</option>
                      <option value="manual">Manual</option>
                      <option value="service_reminder">Service Reminder</option>
                      <option value="renewal_reminder">Renewal Reminder</option>
                    </select>
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
      <div className="panel" style={{ marginBottom: 20 }}>
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
                    {inst.entity_name && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>
                        <span style={{ color: 'var(--text3)' }}>From: </span>
                        <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{inst.entity_name}</span>
                        {inst.trigger_type && (
                          <span style={{ marginLeft: 6, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0px 7px', fontSize: 11 }}>
                            {inst.trigger_type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    )}
                    {tplName && (
                      <div style={{ fontSize: 12, color: 'var(--text3)' }}>{tplName} · Started {formatDate(inst.created_at)}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: pct === 100 ? 'var(--brand)' : 'var(--text2)', background: pct === 100 ? '#e8f4ef' : 'var(--cream2)', padding: '3px 10px', borderRadius: 20 }}>
                    {done}/{total} steps
                  </span>
                </div>

                <div style={{ height: 6, background: 'var(--cream2)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--brand)' : 'var(--brand-light)', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>

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

      {/* ── MANAGE TEMPLATES ──────────────────────────────────────────────── */}
      <div className="panel">
        <div className="panel-header" style={{ marginBottom: 16 }}>
          <div className="panel-title">Manage Templates</div>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="loading">Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">📋</div>
            <div>No templates to manage</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {templates.map(tpl => {
              const isOpen = expandedTemplate === tpl.id;
              const steps = templateSteps[tpl.id] || [];

              return (
                <div
                  key={tpl.id}
                  style={{
                    border: isOpen ? '1px solid #e8c880' : '1px solid var(--border)',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: isOpen ? '#fdf4e8' : 'var(--surface)',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  {/* Template header row */}
                  <button
                    onClick={() => toggleTemplate(tpl.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', fontFamily: 'Playfair Display, serif' }}>
                        {tpl.name}
                      </span>
                      {tpl.category && (
                        <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, padding: '1px 8px' }}>
                          {tpl.category}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 16, color: isOpen ? '#C9A84C' : 'var(--text3)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                      ▾
                    </span>
                  </button>

                  {/* Expanded steps */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #e8c880' }}>
                      {/* Breadcrumb */}
                      <div style={{ padding: '8px 16px', background: '#fdf9ee', borderBottom: '1px solid #f0dfa0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
                        <span>Source Record</span>
                        <span style={{ color: '#e8c880' }}>→</span>
                        <span style={{ color: '#7a5500', fontWeight: 600 }}>{tpl.name}</span>
                        <span style={{ color: '#e8c880' }}>→</span>
                        <span>Tasks ({steps.length})</span>
                      </div>
                      {steps.length === 0 ? (
                        <div style={{ padding: '16px', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
                          No steps defined for this template.
                        </div>
                      ) : (
                        steps.map((step, idx) => {
                          const isEditing = editingStep === step.id;
                          const isSaving = savingStep === step.id;

                          return (
                            <div
                              key={step.id}
                              style={{
                                padding: '12px 16px',
                                borderBottom: idx < steps.length - 1 ? '1px solid #f0dfa0' : 'none',
                                background: isEditing ? '#fffdf5' : 'transparent',
                              }}
                            >
                              {isEditing ? (
                                /* ── Inline edit mode ── */
                                <div>
                                  <div style={{ marginBottom: 8 }}>
                                    <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                                      Step title
                                    </label>
                                    <input
                                      autoFocus
                                      value={editForm.title}
                                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                      style={{
                                        width: '100%', padding: '7px 10px', borderRadius: 7,
                                        border: '1px solid #e8c880', fontSize: 13,
                                        background: '#fff', color: 'var(--text1)', boxSizing: 'border-box',
                                      }}
                                    />
                                  </div>
                                  <div style={{ marginBottom: 10 }}>
                                    <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                                      Description
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={editForm.description}
                                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                      style={{
                                        width: '100%', padding: '7px 10px', borderRadius: 7,
                                        border: '1px solid #e8c880', fontSize: 13,
                                        background: '#fff', color: 'var(--text1)', boxSizing: 'border-box',
                                        resize: 'vertical',
                                      }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      onClick={() => saveEdit(tpl.id, step)}
                                      disabled={isSaving || !editForm.title.trim()}
                                      style={{
                                        padding: '6px 16px', background: 'var(--brand)', color: '#fff',
                                        border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600,
                                        cursor: 'pointer', opacity: (isSaving || !editForm.title.trim()) ? 0.6 : 1,
                                      }}
                                    >
                                      {isSaving ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      disabled={isSaving}
                                      style={{
                                        padding: '6px 14px', background: 'var(--surface2)', color: 'var(--text2)',
                                        border: '1px solid var(--border)', borderRadius: 7, fontSize: 12,
                                        fontWeight: 500, cursor: 'pointer',
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* ── View mode ── */
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                  {/* Step number */}
                                  <span style={{
                                    flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                                    background: '#e8c880', color: '#7a5500', fontSize: 11,
                                    fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginTop: 1,
                                  }}>
                                    {idx + 1}
                                  </span>

                                  {/* Step content */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginBottom: step.description ? 2 : 0 }}>
                                      {step.title}
                                    </div>
                                    {step.description && (
                                      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>
                                        {step.description}
                                      </div>
                                    )}
                                  </div>

                                  {/* Controls */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                    <button
                                      onClick={() => moveStep(tpl.id, step, -1)}
                                      disabled={idx === 0}
                                      title="Move up"
                                      style={{
                                        width: 28, height: 28, border: '1px solid var(--border)',
                                        borderRadius: 6, background: idx === 0 ? 'var(--surface2)' : '#fff',
                                        color: idx === 0 ? 'var(--text3)' : 'var(--text2)',
                                        cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                        fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: idx === 0 ? 0.4 : 1,
                                      }}
                                    >
                                      ↑
                                    </button>
                                    <button
                                      onClick={() => moveStep(tpl.id, step, 1)}
                                      disabled={idx === steps.length - 1}
                                      title="Move down"
                                      style={{
                                        width: 28, height: 28, border: '1px solid var(--border)',
                                        borderRadius: 6, background: idx === steps.length - 1 ? 'var(--surface2)' : '#fff',
                                        color: idx === steps.length - 1 ? 'var(--text3)' : 'var(--text2)',
                                        cursor: idx === steps.length - 1 ? 'not-allowed' : 'pointer',
                                        fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: idx === steps.length - 1 ? 0.4 : 1,
                                      }}
                                    >
                                      ↓
                                    </button>
                                    <button
                                      onClick={() => startEdit(step)}
                                      title="Edit step"
                                      style={{
                                        padding: '4px 11px', border: '1px solid #e8c880',
                                        borderRadius: 6, background: '#fff9ee', color: '#7a5500',
                                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => deleteStep(tpl.id, step)}
                                      disabled={deletingStep === step.id}
                                      title="Delete step"
                                      style={{
                                        padding: '4px 11px', border: '1px solid #e8c880',
                                        borderRadius: 6, background: '#fff9ee', color: '#c0392b',
                                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                        opacity: deletingStep === step.id ? 0.6 : 1,
                                      }}
                                    >
                                      {deletingStep === step.id ? '…' : 'Delete'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}

                      {/* ── Add Step ── */}
                      <div style={{ padding: '12px 16px', borderTop: '1px solid #f0dfa0' }}>
                        {addingStepFor === tpl.id ? (
                          <div style={{ border: '1px solid #e8c880', borderRadius: 8, padding: 12, background: '#fffdf5' }}>
                            <div style={{ marginBottom: 8 }}>
                              <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                                Step title
                              </label>
                              <input
                                autoFocus
                                value={addForm.title}
                                onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                                placeholder="e.g. Review financials"
                                style={{
                                  width: '100%', padding: '7px 10px', borderRadius: 7,
                                  border: '1px solid #e8c880', fontSize: 13,
                                  background: '#fff', color: 'var(--text1)', boxSizing: 'border-box',
                                }}
                              />
                            </div>
                            <div style={{ marginBottom: 10 }}>
                              <label style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                                Description
                              </label>
                              <textarea
                                rows={2}
                                value={addForm.description}
                                onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Optional description"
                                style={{
                                  width: '100%', padding: '7px 10px', borderRadius: 7,
                                  border: '1px solid #e8c880', fontSize: 13,
                                  background: '#fff', color: 'var(--text1)', boxSizing: 'border-box',
                                  resize: 'vertical',
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => saveNewStep(tpl.id)}
                                disabled={savingNewStep || !addForm.title.trim()}
                                style={{
                                  padding: '6px 16px', background: 'var(--brand)', color: '#fff',
                                  border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600,
                                  cursor: 'pointer', opacity: (savingNewStep || !addForm.title.trim()) ? 0.6 : 1,
                                }}
                              >
                                {savingNewStep ? 'Adding…' : 'Add Step'}
                              </button>
                              <button
                                onClick={cancelAddStep}
                                disabled={savingNewStep}
                                style={{
                                  padding: '6px 14px', background: 'var(--surface2)', color: 'var(--text2)',
                                  border: '1px solid var(--border)', borderRadius: 7, fontSize: 12,
                                  fontWeight: 500, cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => startAddStep(tpl.id)}
                            style={{
                              padding: '7px 16px', border: '1px dashed #e8c880',
                              borderRadius: 8, background: 'transparent', color: '#7a5500',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            + Add Step
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
