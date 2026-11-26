jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('./complianceCompletions', () => ({ recordCompletion: jest.fn() }));
jest.mock('./workflowEngine', () => ({ updateWorkflowProgress: jest.fn() }));
import { supabase } from './supabase';
import { taskSource, ensureSetupTask, cancelTasksForSource } from './taskSync';

describe('answers update tasks', () => {
  beforeEach(() => supabase.from.mockReset());

  test('SET UP tasks are grouped under compliance and are reference only', () => {
    const s = taskSource('SET UP: Fire alarms');
    expect(s.tab).toBe('compliance');
    expect(s.action).toBe('reference');
  });

  test('no set-up task when the item already has a due date', async () => {
    await ensureSetupTask({ id: 'a', name: 'X', due_date: '2027-01-01' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('cancel does nothing for an empty list', async () => {
    await cancelTasksForSource([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('cancel only touches open and in-progress tasks for that item', async () => {
    const inFn = jest.fn().mockResolvedValue({});
    const likeFn = jest.fn(() => ({ in: inFn }));
    const updateFn = jest.fn(() => ({ like: likeFn }));
    supabase.from.mockReturnValue({ update: updateFn });
    await cancelTasksForSource(['abc']);
    expect(updateFn).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(likeFn).toHaveBeenCalledWith('description', '%[source_id:abc]%');
    expect(inFn).toHaveBeenCalledWith('status', ['open', 'in-progress']);
  });
});
