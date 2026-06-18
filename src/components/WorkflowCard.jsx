export default function WorkflowCard({ workflow }) {
  const tasks = workflow.tasks || []
  const currentTask = tasks
    .filter(t => t.status !== 'Done' && t.status !== 'completed')
    .sort((a, b) => a.workflow_step_order - b.workflow_step_order)[0]

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">{workflow.name}</h4>
        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
          {workflow.progress_pct || workflow.progress || 0}% complete
        </span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
        <div
          className="bg-[#C9A84C] h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${workflow.progress_pct || workflow.progress || 0}%` }}
        />
      </div>

      {currentTask && (
        <p className="text-xs text-gray-600">
          <span className="font-medium">Next: </span>
          Step {currentTask.workflow_step_order} — {currentTask.title.split(' — ')[1] || currentTask.title}
        </p>
      )}

      {workflow.due_date && (
        <p className="text-xs text-gray-400 mt-1">Due {workflow.due_date}</p>
      )}
    </div>
  )
}
