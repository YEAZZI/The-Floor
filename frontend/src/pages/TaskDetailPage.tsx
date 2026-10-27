import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { errorMessage } from '../api/errorMessage'
import { listMembers, listTags } from '../api/members'
import {
  addStage,
  deleteStage,
  deleteTask,
  getTask,
  setStageStatus,
  updateStage,
  updateTask,
  type CreateStageInput,
  type Stage,
  type StageStatus,
  type TaskDetail,
  type UpdateTaskInput,
} from '../api/tasks'
import { ProgressBar } from '../components/ProgressBar'
import { StageEditor } from '../components/StageEditor'
import { TaskEditForm, type TaskEditValues } from '../components/TaskEditForm'
import { actionLabel, formatDateTime, statusLabel } from '../lib/format'
import {
  localToIso,
  newStageDraft,
  stageDraftToInput,
  stageToDraft,
  type StageDraft,
} from '../lib/TasksForm'
import { useCan, useRoom } from '../room/useRoom'

const MAX_STAGES = 30

export function TaskDetailPage() {
  const { taskId = '' } = useParams()
  const { room, refreshRoom } = useRoom()
  const canEditTask = useCan('task.create')
  const canEditStages = useCan('stage.edit')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const taskKey = ['task', room.id, taskId]

  const [blockingId, setBlockingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [editingTask, setEditingTask] = useState(false)
  // A stage id, or 'new' while adding a stage.
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)

  const task = useQuery({
    queryKey: taskKey,
    queryFn: () => getTask(room.id, taskId),
    retry: false,
  })

  const tags = useQuery({
    queryKey: ['tags', room.id],
    queryFn: () => listTags(room.id),
    enabled: canEditStages,
  })
  const members = useQuery({
    queryKey: ['members', room.id, 'all'],
    queryFn: () => listMembers(room.id, 1, 100),
    enabled: canEditStages,
  })

  function begin() {
    setActionError(null)
    setFieldErrors({})
  }

  // Every task change returns the whole task, so it goes straight into the cache.
  function applyUpdated(updated: unknown) {
    queryClient.setQueryData(taskKey, updated as TaskDetail)
    void queryClient.invalidateQueries({ queryKey: ['tasks', room.id] })
  }

  function handleFailure(err: unknown) {
    if (err instanceof ApiError) {
      if (err.status === 403) refreshRoom()
      // 403 or 409 usually means our copy was stale, so reload it.
      if (err.status === 403 || err.status === 409) {
        void queryClient.invalidateQueries({ queryKey: taskKey })
      }
      if (err.fields) {
        setFieldErrors(err.fields)
        setActionError('Please fix the highlighted fields.')
        return
      }
    }
    setActionError(errorMessage(err))
  }

  const change = useMutation({
    mutationFn: (vars: {
      stageId: string
      status: StageStatus
      reason?: string
    }) => setStageStatus(room.id, taskId, vars.stageId, vars.status, vars.reason),
    onMutate: begin,
    onSuccess: (updated) => {
      applyUpdated(updated)
      setBlockingId(null)
      setReason('')
    },
    onError: handleFailure,
  })

  const saveTask = useMutation({
    mutationFn: (patch: UpdateTaskInput) => updateTask(room.id, taskId, patch),
    onMutate: begin,
    onSuccess: (updated) => {
      applyUpdated(updated)
      setEditingTask(false)
    },
    onError: handleFailure,
  })

  const saveStage = useMutation({
    mutationFn: (vars: { stageId: string | null; input: CreateStageInput }) =>
      vars.stageId
        ? updateStage(room.id, taskId, vars.stageId, vars.input)
        : addStage(room.id, taskId, vars.input),
    onMutate: begin,
    onSuccess: (updated) => {
      applyUpdated(updated)
      setEditingStageId(null)
    },
    onError: handleFailure,
  })

  const moveStage = useMutation({
    mutationFn: (vars: { stageId: string; position: number }) =>
      updateStage(room.id, taskId, vars.stageId, { position: vars.position }),
    onMutate: begin,
    onSuccess: applyUpdated,
    onError: handleFailure,
  })

  const removeStage = useMutation({
    mutationFn: (stageId: string) => deleteStage(room.id, taskId, stageId),
    onMutate: begin,
    onSuccess: applyUpdated,
    onError: handleFailure,
  })

  const removeTask = useMutation({
    mutationFn: () => deleteTask(room.id, taskId),
    onMutate: begin,
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: taskKey })
      await queryClient.invalidateQueries({ queryKey: ['tasks', room.id] })
      navigate(`/rooms/${room.id}`)
    },
    onError: handleFailure,
  })

  const busy =
    change.isPending ||
    saveTask.isPending ||
    saveStage.isPending ||
    moveStage.isPending ||
    removeStage.isPending ||
    removeTask.isPending

  function handleAction(stage: Stage, target: StageStatus) {
    if (target === 'blocked') {
      setBlockingId(stage.id)
      setReason('')
      return
    }
    change.mutate({ stageId: stage.id, status: target })
  }

  function handleBlockSubmit(e: FormEvent) {
    e.preventDefault()
    if (blockingId) {
      change.mutate({
        stageId: blockingId,
        status: 'blocked',
        reason: reason.trim(),
      })
    }
  }

  function handleSaveTask(values: TaskEditValues, current: TaskDetail) {
    saveTask.mutate({
      title: values.title.trim(),
      description: values.description.trim() || null,
      start_date: localToIso(values.start),
      due_date: localToIso(values.due) ?? current.due_date,
    })
  }

  function handleSaveStage(
    draft: StageDraft,
    stageId: string | null,
    isFirst: boolean,
  ) {
    saveStage.mutate({ stageId, input: stageDraftToInput(draft, isFirst) })
  }

  function handleMove(stage: Stage, direction: -1 | 1) {
    moveStage.mutate({ stageId: stage.id, position: stage.position + direction })
  }

  function handleDeleteStage(stage: Stage) {
    if (window.confirm(`Delete the stage "${stage.title}"?`)) {
      removeStage.mutate(stage.id)
    }
  }

  function handleDeleteTask(current: TaskDetail) {
    if (window.confirm(`Delete "${current.title}"? This cannot be undone.`)) {
      removeTask.mutate()
    }
  }

  function closeStageEditor() {
    setEditingStageId(null)
    setFieldErrors({})
  }

  if (task.isPending) return <p>Loading task...</p>

  if (task.isError) {
    const notFound =
      task.error instanceof ApiError && task.error.status === 404
    return (
      <div>
        <p>{notFound ? 'Task not found.' : 'Could not load this task.'}</p>
        <Link to={`/rooms/${room.id}`}>Back to tasks</Link>
      </div>
    )
  }

  const t = task.data

  return (
    <div>
      <p>
        <Link to={`/rooms/${room.id}`}>&larr; Back to tasks</Link>
      </p>

      {editingTask ? (
        <TaskEditForm
          task={t}
          errors={fieldErrors}
          saving={saveTask.isPending}
          onSave={(values) => handleSaveTask(values, t)}
          onCancel={() => {
            setEditingTask(false)
            setFieldErrors({})
          }}
        />
      ) : (
        <>
          <h1>{t.title}</h1>
          <p>
            {t.status === 'done' && <span className="badge done">Done</span>}
            {t.is_blocked && <span className="badge blocked">Blocked</span>}
            {t.is_overdue && <span className="badge overdue">Overdue</span>}
          </p>
          {t.description && <p>{t.description}</p>}

          {canEditTask && (
            <div className="actions">
              <button
                disabled={busy}
                onClick={() => {
                  setFieldErrors({})
                  setEditingTask(true)
                }}
              >
                Edit task
              </button>
              <button disabled={busy} onClick={() => handleDeleteTask(t)}>
                Delete task
              </button>
            </div>
          )}
        </>
      )}

      <ProgressBar value={t.progress} />
      <p className="muted">
        {t.stages_done} of {t.stages_total} stages
        {t.start_date ? ` · starts ${formatDateTime(t.start_date)}` : ''} · due{' '}
        {formatDateTime(t.due_date)} · created by {t.created_by.name}
      </p>

      <h2>Stages</h2>

      {actionError && <div className="form-error">{actionError}</div>}

      {t.stages.map((stage, index) => (
        <div className={`stage ${stage.status}`} key={stage.id}>
          <div className="task-card-top">
            <strong>
              {stage.position}. {stage.title}
            </strong>
            <span>
              {stage.is_overdue && <span className="badge overdue">Overdue</span>}
              <span className={`badge status-${stage.status}`}>
                {statusLabel(stage.status)}
              </span>
            </span>
          </div>

          <div className="muted">
            Step {stage.step}
            {stage.parallel_with_previous ? ' (runs with the previous stage)' : ''}
            {stage.due_date ? ` · due ${formatDateTime(stage.due_date)}` : ''}
          </div>

          <div>
            {stage.tag && <span className="chip">{stage.tag.name}</span>}
            {stage.assignees.length > 0 ? (
              <span>{stage.assignees.map((a) => a.name).join(', ')}</span>
            ) : (
              !stage.tag && <span className="muted">Unassigned</span>
            )}
          </div>

          {stage.status === 'blocked' && stage.blocked_reason && (
            <div className="form-error">Blocked: {stage.blocked_reason}</div>
          )}

          {stage.status === 'done' && stage.completed_at && (
            <div className="muted">
              Completed {formatDateTime(stage.completed_at)}
              {stage.completed_by ? ` by ${stage.completed_by.name}` : ''}
            </div>
          )}

          {stage.allowed_statuses.length > 0 && (
            <div className="actions">
              {stage.allowed_statuses.map((target) => (
                <button
                  key={target}
                  disabled={busy}
                  onClick={() => handleAction(stage, target)}
                >
                  {actionLabel(stage.status, target)}
                </button>
              ))}
            </div>
          )}

          {blockingId === stage.id && (
            <form className="inline-form" onSubmit={handleBlockSubmit}>
              <input
                aria-label="Reason for blocking"
                placeholder="Why is this blocked?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                required
              />
              <button type="submit" disabled={busy}>
                Confirm
              </button>
              <button type="button" onClick={() => setBlockingId(null)}>
                Cancel
              </button>
              {fieldErrors.blocked_reason && (
                <span className="field-error">{fieldErrors.blocked_reason}</span>
              )}
            </form>
          )}

          {canEditStages && editingStageId !== stage.id && (
            <div className="actions stage-tools">
              <button
                disabled={busy}
                onClick={() => {
                  setFieldErrors({})
                  setEditingStageId(stage.id)
                }}
              >
                Edit
              </button>
              <button
                disabled={busy || index === 0}
                onClick={() => handleMove(stage, -1)}
              >
                Up
              </button>
              <button
                disabled={busy || index === t.stages.length - 1}
                onClick={() => handleMove(stage, 1)}
              >
                Down
              </button>
              <button
                disabled={busy || t.stages.length === 1}
                onClick={() => handleDeleteStage(stage)}
              >
                Delete
              </button>
            </div>
          )}

          {editingStageId === stage.id && (
            <StageEditor
              key={stage.id}
              mode="edit"
              initial={stageToDraft(stage)}
              index={stage.position - 1}
              tags={tags.data?.items ?? []}
              members={members.data?.items ?? []}
              errors={fieldErrors}
              saving={saveStage.isPending}
              onSave={(draft) =>
                handleSaveStage(draft, stage.id, stage.position === 1)
              }
              onCancel={closeStageEditor}
            />
          )}
        </div>
      ))}

      {canEditStages &&
        (editingStageId === 'new' ? (
          <StageEditor
            key="new"
            mode="add"
            initial={newStageDraft()}
            index={t.stages.length}
            tags={tags.data?.items ?? []}
            members={members.data?.items ?? []}
            errors={fieldErrors}
            saving={saveStage.isPending}
            onSave={(draft) => handleSaveStage(draft, null, false)}
            onCancel={closeStageEditor}
          />
        ) : (
          <p>
            <button
              disabled={busy || t.stages.length >= MAX_STAGES}
              onClick={() => {
                setFieldErrors({})
                setEditingStageId('new')
              }}
            >
              + Add stage
            </button>
          </p>
        ))}
    </div>
  )
}

