import { supabase } from './supabase';

// Creates a workflow instance from a template and inserts a task for each step.
// context: { name?, assigned_to?, start_date? } — optional overrides per instance.
export async function startWorkflow(templateId, context = {}) {
  const { data: template, error: tErr } = await supabase
    .from('workflow_templates')
    .select('id, name')
    .eq('id', templateId)
    .single();
  if (tErr || !template) throw new Error(`Workflow template not found: ${templateId}`);

  const { data: steps, error: sErr } = await supabase
    .from('workflow_steps')
    .select('id, name, description, step_order, assigned_to, due_days_offset')
    .eq('template_id', templateId)
    .order('step_order', { ascending: true });
  if (sErr) throw sErr;

  const { data: instance, error: iErr } = await supabase
    .from('workflow_instances')
    .insert({
      template_id: templateId,
      name: context.name || template.name,
      status: 'active',
      progress: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (iErr) throw iErr;

  if (steps && steps.length > 0) {
    const today = context.start_date ? new Date(context.start_date) : new Date();
    const tasks = steps.map(step => {
      let due_date = null;
      if (step.due_days_offset != null) {
        const d = new Date(today);
        d.setDate(d.getDate() + step.due_days_offset);
        due_date = d.toISOString().split('T')[0];
      }
      return {
        title: step.name,
        description: step.description || '',
        assigned_to: context.assigned_to || step.assigned_to || null,
        due_date,
        priority: 'Medium',
        status: 'open',
        workflow_instance_id: instance.id,
        workflow_step_order: step.step_order,
      };
    });
    const { error: taskErr } = await supabase.from('tasks').insert(tasks);
    if (taskErr) throw taskErr;
  }

  return instance;
}

// Recalculates progress for a workflow instance based on its completed tasks,
// then writes the result back. Marks the instance complete when all steps are done.
export async function updateWorkflowProgress(workflowInstanceId) {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, status')
    .eq('workflow_instance_id', workflowInstanceId);
  if (error) throw error;
  if (!tasks || tasks.length === 0) return;

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'completed').length;
  const progress = Math.round((done / total) * 100);
  const allDone = done === total;

  const updates = { progress };
  if (allDone) {
    updates.status = 'completed';
    updates.completed_at = new Date().toISOString();
  }

  await supabase
    .from('workflow_instances')
    .update(updates)
    .eq('id', workflowInstanceId);
}

// Returns all active workflow instances joined with their template name.
export async function getActiveWorkflows() {
  const { data, error } = await supabase
    .from('workflow_instances')
    .select('*, workflow_templates(name)')
    .eq('status', 'active')
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
