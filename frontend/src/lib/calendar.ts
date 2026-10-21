import type { EventInput } from '@fullcalendar/react'
import type { TaskListItem } from '../api/tasks'

export function taskToEvent(task: TaskListItem): EventInput {
  const color =
    task.status === 'done'
      ? '#2f9e44'
      : task.is_overdue
        ? '#c62828'
        : task.is_blocked
          ? '#e8590c'
          : '#3b5bdb'

  return {
    id: task.id,
    title: task.title,
    // No start date: a point at the due date. With one: a bar from start to due.
    start: task.start_date ?? task.due_date,
    end: task.start_date ? task.due_date : undefined,
    backgroundColor: color,
    borderColor: color,
    extendedProps: { progress: task.progress },
  }
}