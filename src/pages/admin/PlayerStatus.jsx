import { label, REGISTRATION_STATUS } from '../../lib/codes'

const STYLE = {
  A: 'bg-success-bg text-success-fg',
  R: 'bg-info-bg text-info-fg',
  P: 'bg-warning-bg text-warning-fg',
  F: 'bg-danger-bg text-danger-fg',
  V: 'bg-danger-bg text-danger-fg',
}

// A player's status as a badge: Active, Ready, Pending, Failed, Revoked, Deleted
export default function PlayerStatus({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLE[status] ?? 'bg-surface-3 text-fg-2'}`}>
      {label(REGISTRATION_STATUS, status)}
    </span>
  )
}
