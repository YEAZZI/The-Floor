import { useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import type { DatesSetInfo, EventClickInfo } from '@fullcalendar/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listTasks } from '../api/tasks'
import { taskToEvent } from '../lib/calendar'
import { useRoom } from '../room/useRoom'

// A busy month can have many tasks, and the calendar needs all of them.
// If the backend caps the page size lower, change this number.
const CALENDAR_LIMIT = 500

export function CalendarPage() {
  const { room } = useRoom()
  const navigate = useNavigate()
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)

  const tasks = useQuery({
    queryKey: ['tasks', room.id, 'calendar', range?.from, range?.to],
    queryFn: () =>
      listTasks(room.id, {
        from: range?.from,
        to: range?.to,
        limit: CALENDAR_LIMIT,
      }),
    enabled: range !== null,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })

  const events = useMemo(
    () => (tasks.data?.items ?? []).map(taskToEvent),
    [tasks.data],
  )

  function handleDatesSet(arg: DatesSetInfo) {
    // arg.end is exclusive, which matches the backend's [from, to) window.
    const from = arg.start.toISOString()
    const to = arg.end.toISOString()
    setRange((prev) =>
      prev && prev.from === from && prev.to === to ? prev : { from, to },
    )
  }

  function handleEventClick(arg: EventClickInfo) {
    navigate(`/rooms/${room.id}/tasks/${arg.event.id}`)
  }

  return (
    <div>
      <h1>Calendar</h1>

      {tasks.isError && (
        <div className="form-error">Could not load tasks for this period.</div>
      )}

      <div className="calendar-wrap">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          height="auto"
          events={events}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          defaultTimedEventDuration="00:30"
          eventContent={(arg) => (
            <span>
              {arg.event.title} · {arg.event.extendedProps.progress}%
            </span>
          )}
        />
      </div>

      <p className="legend">
        <span>
          <i style={{ background: '#3b5bdb' }} /> In progress
        </span>
        <span>
          <i style={{ background: '#e8590c' }} /> Blocked
        </span>
        <span>
          <i style={{ background: '#c62828' }} /> Overdue
        </span>
        <span>
          <i style={{ background: '#2f9e44' }} /> Done
        </span>
      </p>
    </div>
  )
}