import { eventPhase } from '../lib/codes'

const STYLE = {
  Running: 'bg-success-bg text-success-fg',
  Frozen: 'bg-info-bg text-info-fg',
  Upcoming: 'bg-warning-bg text-warning-fg',
}

// The phase of an event (or Closed) as a small badge
export default function PhaseBadge({ event }) {
  const phase = eventPhase(event)
  if (!phase) return null
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLE[phase] ?? 'bg-surface-3 text-fg-2'}`}>
      {phase}
    </span>
  )
}
