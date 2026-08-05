-- Prevents the race condition found in taskSync.js's ensureTask()/
-- ensureUpcomingTask(): both do a check-then-insert (SELECT for an
-- existing open/in-progress task, INSERT only if none found) with no
-- atomicity guarantee. If the same source item gets processed twice
-- within milliseconds (React dev-mode double-firing useEffect, or a
-- rapid double page-load), both SELECTs can return empty before either
-- INSERT commits, creating two identical rows. Confirmed for real on
-- Tineka: 3 pairs of byte-identical duplicate tasks, each pair created
-- 19-48ms apart, all within the same ~1.4s window (2026-07-24 21:22:42-43)
-- - cleaned up in a separate step before this migration.
--
-- Deliberately NOT a plain unique(title) - that would break legitimate
-- manual task creation (two trustees could reasonably create different
-- tasks that happen to share wording). Scoped narrowly to the exact
-- shape of tasks these two functions create: one of the 8 known
-- auto-generated prefixes from TASK_SOURCES (taskSync.js), and only
-- while the task is active (open/in-progress) - a completed/cancelled
-- task legitimately coexisting with a new one sharing the same title
-- (e.g. a recurring OVERDUE reminder recreated next cycle) is fine and
-- must not be blocked.
--
-- No application code change needed: both functions already call
-- `await supabase.from('tasks').insert({...})` without checking the
-- returned error, so a constraint violation on the racing second
-- insert fails silently - exactly the no-op behavior the existing
-- dedup check already intended, just made atomic instead of racy.

create unique index if not exists idx_tasks_unique_active_auto_title
on tasks (title)
where status in ('open', 'in-progress')
  and title ~ '^(UPCOMING|OVERDUE|PROJECT|SERVICE|ACTION|GOAL|GRANT|FINANCE): ';
