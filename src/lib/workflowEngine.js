import { supabase } from './supabase';

export async function startWorkflow(templateId, context = {}) {
  const { data: steps, error: stepsError } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('template_id', templateId)
    .order('step_order');

  if (stepsError) throw stepsError;

  const { data: instance, error: instanceError } = await supabase
    .from('workflow_instances')
    .insert({
      template_id: templateId,
      name: context.name,
      due_date: context.due_date || null,
      created_by: context.assigned_to || null,
      progress_pct: 0,
      status: 'active'
    })
    .select()
    .single();

  if (instanceError) throw instanceError;

  const tasks = steps.map(s => ({
    title: `${context.name} — ${s.title}`,
    description: s.description,
    status: 'open',
    workflow_instance_id: instance.id,
    workflow_step_order: s.step_order,
    assigned_to: context.assigned_to || null
  }));

  const { error: tasksError } = await supabase.from('tasks').insert(tasks);
  if (tasksError) throw tasksError;

  return instance;
}

export async function updateWorkflowProgress(workflowInstanceId) {
  if (!workflowInstanceId) return;

  const { data: tasks } = await supabase
    .from('tasks')
    .select('status')
    .eq('workflow_instance_id', workflowInstanceId);

  if (!tasks || tasks.length === 0) return;

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'Done').length;
  const progress = Math.round((done / total) * 100);
  const allDone = done === total;

  await supabase
    .from('workflow_instances')
    .update({
      progress_pct: progress,
      status: allDone ? 'complete' : 'active',
      completed_at: allDone ? new Date().toISOString() : null
    })
    .eq('id', workflowInstanceId);

  return progress;
}

export async function getActiveWorkflows() {
  const { data } = await supabase
    .from('workflow_instances')
    .select('*, workflow_templates(name, category), tasks(status, workflow_step_order, title)')
    .eq('status', 'active')
    .order('started_at', { ascending: false });

  return data || [];
}

export async function getWorkflowTemplates() {
  const { data } = await supabase
    .from('workflow_templates')
    .select('*, workflow_steps(id)')
    .eq('is_active', true);

  return data || [];
}
