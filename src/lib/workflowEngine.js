import { supabase } from './supabase';

export async function startWorkflow(templateId, context = {}) {
  console.log('[startWorkflow] START — templateId:', templateId, 'context:', context);

  // 1) Load steps
  console.log('[startWorkflow] loading workflow_steps for template', templateId);
  const { data: steps, error: stepsError } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('template_id', templateId)
    .order('step_order');

  if (stepsError) {
    console.error('[startWorkflow] failed to load steps:', stepsError);
    throw stepsError;
  }
  console.log('[startWorkflow] steps loaded:', steps?.length ?? 0, 'steps', steps);

  // 2) Create workflow instance
  const instancePayload = {
    template_id: templateId,
    name: context.name,
    due_date: context.due_date || null,
    created_by: context.assigned_to || null,
    progress_pct: 0,
    status: 'active',
    entity_type: context.entity_type || null,
    entity_id: context.entity_id || null,
    entity_name: context.entity_name || null,
    trigger_type: context.trigger_type || null,
    trigger_date: context.trigger_date || null,
  };
  console.log('[startWorkflow] inserting workflow_instance with payload:', instancePayload);
  const { data: instance, error: instanceError } = await supabase
    .from('workflow_instances')
    .insert(instancePayload)
    .select()
    .single();

  if (instanceError) {
    console.error('[startWorkflow] workflow_instance insert failed:', instanceError);
    throw instanceError;
  }
  console.log('[startWorkflow] workflow_instance created — id:', instance.id, 'result:', instance);

  // 3) Create parent task
  const parentPayload = {
    title: context.name,
    status: 'open',
    workflow_instance_id: instance.id,
  };
  console.log('[startWorkflow] attempting parent task insert with payload:', parentPayload);
  const { data: parentTask, error: parentError } = await supabase
    .from('tasks')
    .insert(parentPayload)
    .select()
    .single();

  if (parentError) {
    console.error('[startWorkflow] parent task insert FAILED — error:', parentError, 'payload was:', parentPayload);
    throw parentError;
  }
  console.log('[startWorkflow] parent task insert SUCCESS — id:', parentTask.id, 'result:', parentTask);

  // 4) Create subtasks
  const subtasks = steps.map(s => ({
    title: s.title,
    description: s.description,
    status: 'open',
    workflow_instance_id: instance.id,
    workflow_step_order: s.step_order,
    parent_task_id: parentTask.id,
  }));
  console.log('[startWorkflow] attempting subtask insert —', subtasks.length, 'subtasks:', subtasks);
  const { data: insertedSubtasks, error: subtasksError } = await supabase
    .from('tasks')
    .insert(subtasks)
    .select();

  if (subtasksError) {
    console.error('[startWorkflow] subtasks insert FAILED — error:', subtasksError, 'payload was:', subtasks);
    throw subtasksError;
  }
  console.log('[startWorkflow] subtasks insert SUCCESS —', insertedSubtasks?.length, 'inserted for instance', instance.id);

  return instance;
}

export async function updateWorkflowProgress(workflowInstanceId) {
  if (!workflowInstanceId) return;

  // Count only subtasks, not the parent task
  const { data: subtasks } = await supabase
    .from('tasks')
    .select('status')
    .eq('workflow_instance_id', workflowInstanceId)
    .not('parent_task_id', 'is', null);

  if (!subtasks || subtasks.length === 0) return;

  const total = subtasks.length;
  const done = subtasks.filter(t => t.status === 'completed').length;
  const progress = Math.round((done / total) * 100);
  const allDone = done === total;
  const someStarted = done > 0;

  await supabase
    .from('workflow_instances')
    .update({
      progress_pct: progress,
      status: allDone ? 'complete' : 'active',
      completed_at: allDone ? new Date().toISOString() : null,
    })
    .eq('id', workflowInstanceId);

  // Keep parent task status in sync with subtask completion
  const parentStatus = allDone ? 'completed' : (someStarted ? 'in-progress' : 'open');
  await supabase
    .from('tasks')
    .update({
      status: parentStatus,
      completed_at: allDone ? new Date().toISOString() : null,
    })
    .eq('workflow_instance_id', workflowInstanceId)
    .is('parent_task_id', null);

  return progress;
}

export async function getActiveWorkflows() {
  const { data, error } = await supabase
    .from('workflow_instances')
    .select('*, workflow_templates(name, category), tasks(id, status, workflow_step_order, title, parent_task_id)')
    .eq('status', 'active')
    .order('started_at', { ascending: false });

  if (error) console.error('[getActiveWorkflows] query error:', error);

  // Expose only subtasks for progress calculation in WorkflowEngine panel
  return (data || []).map(inst => ({
    ...inst,
    tasks: (inst.tasks || []).filter(t => t.parent_task_id),
  }));
}

export async function getWorkflowTemplates() {
  const { data } = await supabase
    .from('workflow_templates')
    .select('*, workflow_steps(id)')
    .eq('is_active', true);

  return data || [];
}
