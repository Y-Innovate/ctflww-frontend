import { BASE } from '../../api/client'
import CopyButton from '../../components/CopyButton'
import { linkTo, PATHS } from '../../routes'

// A new claim token (after a reset, or the retry of a CREATE or RESET), shown
// once with the link the player needs for R3. Never stored or logged.
export default function ClaimTokenNote({ claimToken, provJobID, playerID, playerName }) {
  const link = `${window.location.origin}${BASE}${linkTo(PATHS.register, { registrationID: playerID })}`
  return (
    <div role="status" className="card flex flex-col gap-3 border-warning-fg/40 p-6 text-[13px]">
      <h2 className="text-[15px] font-medium">Hand this over to {playerName || `player ${playerID}`}</h2>
      <p className="text-fg-2">
        Job {provJobID} sets a one-time passphrase. This claim token is shown only now; it isn&apos;t stored here.
        Give it to the player in person or another safe way, with the link. Once the job is done, the player chooses a new
        passphrase there.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded bg-surface-2 px-3 py-1.5 font-mono text-[15px]">{claimToken}</code>
        <CopyButton text={claimToken} label="Copy claim token" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <code className="break-all font-mono text-[12px] text-fg-2">{link}</code>
        <CopyButton text={link} label="Copy link" />
      </div>
    </div>
  )
}
