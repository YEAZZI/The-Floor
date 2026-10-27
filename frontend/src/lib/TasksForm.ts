import type { CreateStageInput, CreateTaskInput, Stage } from '../api/tasks'

export type StageDraft = {
  key: string
  title: string
  tagId: string
  assigneeIds: string[]
  due: string
  parallel: boolean
}

export type TaskDraft = {
  title: string
  description: string
  start: string
  due: string
  stages: StageDraft[]
}

export function newStageDraft(): StageDraft {
  return {
    key: crypto.randomUUID(),
    title: '',
    tagId: '',
    assigneeIds: [],
    due: '',
    parallel: false,
  }
}

// "2026-10-30T17:00" (local time from a datetime-local input) to a UTC ISO string.
export function localToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function buildCreateInput(draft: TaskDraft): CreateTaskInput {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    start_date: localToIso(draft.start),
    due_date: localToIso(draft.due) ?? '',
    stages: draft.stages.map((s, i) => ({
      title: s.title.trim(),
      tag_id: s.tagId || null,
      assignee_ids: s.assigneeIds,
      due_date: localToIso(s.due),
      parallel_with_previous: i === 0 ? false : s.parallel,
    })),
  }
}

// An ISO UTC string to the "2026-10-30T17:00" local time a datetime-local input expects.
export function isoToLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function stageToDraft(stage: Stage): StageDraft {
  return {
    key: stage.id,
    title: stage.title,
    tagId: stage.tag?.id ?? '',
    assigneeIds: stage.assignees.map((a) => a.id),
    due: isoToLocal(stage.due_date),
    parallel: stage.parallel_with_previous,
  }
}

export function stageDraftToInput(
  draft: StageDraft,
  isFirst: boolean,
): CreateStageInput {
  return {
    title: draft.title.trim(),
    tag_id: draft.tagId || null,
    assignee_ids: draft.assigneeIds,
    due_date: localToIso(draft.due),
    parallel_with_previous: isFirst ? false : draft.parallel,
  }
}