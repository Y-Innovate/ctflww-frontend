import PhaseBadge from '../../components/PhaseBadge'

// For organizers: Draft, or the phase of a published event, or Closed
export default function StatusBadge({ event }) {
  if (event.eventStatus === 'D') {
    return (
      <span className="inline-flex rounded-full border-[0.5px] border-dashed border-line-strong px-2 py-0.5 text-[11px] font-medium text-fg-2">
        Draft
      </span>
    )
  }
  return <PhaseBadge event={event} />
}
