import { useState, type FormEvent } from 'react'
import type { TaskDetail } from '../api/tasks'
import { isoToLocal } from '../lib/TasksForm'

export type TaskEditValues = {
  title: string
  description: string
  start: string
  due: string
}

type Props = {
  task: TaskDetail
  errors: Record<string, string>
  saving: boolean
  onSave: (values: TaskEditValues) => void
  onCancel: () => void
}

export function TaskEditForm({ task, errors, saving, onSave, onCancel }: Props) {
  const [v, setV] = useState<TaskEditValues>(() => ({
    title: task.title,
    description: task.description ?? '',
    start: isoToLocal(task.start_date),
    due: isoToLocal(task.due_date),
  }))

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSave(v)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="edit-title">Title</label>
        <input
          id="edit-title"
          value={v.title}
          onChange={(e) => setV((x) => ({ ...x, title: e.target.value }))}
          maxLength={200}
          required
        />
        {errors.title && <span className="field-error">{errors.title}</span>}
      </div>

      <div className="field">
        <label htmlFor="edit-description">Description</label>
        <textarea
          id="edit-description"
          rows={3}
          value={v.description}
          onChange={(e) => setV((x) => ({ ...x, description: e.target.value }))}
          maxLength={5000}
        />
        {errors.description && (
          <span className="field-error">{errors.description}</span>
        )}
      </div>

      <div className="field">
        <label htmlFor="edit-start">Start (optional)</label>
        <input
          id="edit-start"
          type="datetime-local"
          value={v.start}
          onChange={(e) => setV((x) => ({ ...x, start: e.target.value }))}
        />
        {errors.start_date && (
          <span className="field-error">{errors.start_date}</span>
        )}
      </div>

      <div className="field">
        <label htmlFor="edit-due">Due</label>
        <input
          id="edit-due"
          type="datetime-local"
          value={v.due}
          onChange={(e) => setV((x) => ({ ...x, due: e.target.value }))}
          required
        />
        {errors.due_date && (
          <span className="field-error">{errors.due_date}</span>
        )}
      </div>

      <div className="actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save task'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}