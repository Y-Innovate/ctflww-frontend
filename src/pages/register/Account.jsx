import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { registrationStatus } from '../../api/registration'
import CopyButton from '../../components/CopyButton'
import ErrorBanner from '../../components/ErrorBanner'
import { usePolling } from '../../hooks/usePolling'
import { PATHS } from '../../routes'
import Activate from './Activate'

const POLL_MS = 5000

// R2 and R3: wait for the RACF job, then choose a passphrase
export default function Account({ registrationID, claimToken }) {
  const [status, setStatus] = useState({ code: '', error: null })
  const [userid, setUserid] = useState('')

  const check = useCallback(() => registrationStatus(registrationID).then(
    (r) => setStatus({ code: r.registrationStatus, error: null }),
    (error) => setStatus((s) => ({ ...s, error })),
  ), [registrationID])

  useEffect(() => {
    check()
  }, [check])
  usePolling(check, POLL_MS, status.code === 'P' || status.code === '')

  if (userid) return <Done userid={userid} />
  if (status.error?.isNotFound) {
    return <Card title="Registration not found">There is no registration with this number.</Card>
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      {claimToken && <ClaimToken token={claimToken} />}
      {status.error && <ErrorBanner error={status.error} onRetry={check} />}
      {status.code === 'P' && (
        <Card title="Your userid is being made">
          <span className="flex items-center gap-2">
            <i className="ti ti-loader-2 animate-spin" aria-hidden="true" />
            A job on the mainframe creates your userid. This usually takes a minute; this page checks every few seconds.
          </span>
        </Card>
      )}
      {status.code === 'R' && <Activate registrationID={registrationID} claimToken={claimToken} onDone={setUserid} />}
      {status.code === 'F' && (
        <Card title="Something went wrong">
          The job that makes your userid failed. Ask an organizer for help, and give them registration number {registrationID}.
        </Card>
      )}
      {status.code === 'A' && (
        <Card title="Your account is ready">
          You chose your passphrase already. <Link className="underline" to={PATHS.login}>Sign in</Link> with your userid.
        </Card>
      )}
      {(status.code === 'V' || status.code === 'X') && (
        <Card title="This registration can't be used">
          It wasn&apos;t activated in time, or has been closed. Ask an organizer, or register again.
        </Card>
      )}
    </section>
  )
}

function Card({ title, children }) {
  return (
    <div className="card p-6">
      <h1 className="text-[17px] font-medium">{title}</h1>
      <div className="mt-1 text-[13px] text-fg-2">{children}</div>
    </div>
  )
}

// Shown once, right after registering: the backend keeps only a hash of it
function ClaimToken({ token }) {
  return (
    <div className="card border-warning-fg p-6">
      <h1 className="text-[17px] font-medium">Write down your claim token</h1>
      <p className="mt-1 text-[13px] text-fg-2">
        You need it in the next step, to choose your passphrase. It is shown only this once: if you lose it, an organizer
        has to reset your registration.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="rounded-md bg-surface-2 px-3 py-2 font-mono text-[18px] tracking-wider" aria-label="Claim token">
          {token}
        </code>
        <CopyButton text={token} />
      </div>
    </div>
  )
}

function Done({ userid }) {
  const signIn = `${PATHS.login}?userid=${encodeURIComponent(userid)}&returnTo=${encodeURIComponent('/ctf/my')}`
  return (
    <section className="card mx-auto w-full max-w-md p-6">
      <h1 className="text-[17px] font-medium">You&apos;re all set</h1>
      <p className="mt-1 text-[13px] text-fg-2">Your userid is</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code className="rounded-md bg-surface-2 px-3 py-2 font-mono text-[22px] tracking-wider" aria-label="Your userid">
          {userid}
        </code>
        <CopyButton text={userid} />
      </div>
      <p className="mt-3 text-[13px] text-fg-2">
        Sign in with this userid and the passphrase you just chose, here and on the mainframe.
      </p>
      <Link className="btn-primary mt-4 justify-center" to={signIn}>Sign in</Link>
    </section>
  )
}
