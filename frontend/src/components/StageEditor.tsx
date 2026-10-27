import { useState } from 'react'
import type { Member, Tag } from '../api/members'
import type { StageDraft } from '../lib/TasksForm'
import { StageDraftCard } from './StageDraftCard'

type Props = {
  mode: 'add' | 'edit'
  initial: StageDraft
  index: number
  tags: Tag[]
  members: Member[]
  errors: Record<string, string>
  saving: boolean
  onSave: (draft: StageDraft) => void
  onCancel: () => void
}

export function StageEditor({
  mode,
  initial,
  index,
  tags,
  members,
  errors,
  saving,
  onSave,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<StageDraft>(initial)

  const scoped = Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [
      key.startsWith('stages.') ? key : `stages.${index}.${key}`,
      value,
    ]),
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft)
      }}
    >
      <StageDraftCard
        index={index}
        count={1}
        draft={draft}
        tags={tags}
        members={members}
        errors={scoped}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      />
      <div className="actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : mode === 'add' ? 'Add stage' : 'Save stage'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}