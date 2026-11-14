import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ORGANIZER_SIGN_IN_URL } from '../api/auth'
import { BASE, goTo } from '../api/client'
import ErrorBanner from '../components/ErrorBanner'
import { useSession } from '../context/SessionContext'
import { rememberReturn, safeReturn } from '../lib/returnTo'
import { PATHS } from '../routes'

// Sign-in (P1). A plain form post to LWW's process_login.html, whose sign-in
// program (LWWADPLI) checks userid and passphrase with RACF and starts the
// session. The passphrase goes straight from the form to LWW: the app never
// keeps it. Organizers use LWW's Entra redirect instead.
export default function Login() {
  const [params] = useSearchParams()
  const { user } = useSession()
  const [showPassphrase, setShowPassphrase] = useState(false)
  const failed = params.has('failed')
  const requested = safeReturn(params.get('requestedURL') ?? params.get('returnTo'))

  useEffect(() => {
    rememberReturn(requested)
  }, [requested])

  return (
    <section className="card mx-auto w-full max-w-sm p-6">
      <h1 className="text-[17px] font-medium">Sign in</h1>
      <p className="mt-1 text-[13px] text-fg-2">With the userid you got when you registered, such as CTF0042.</p>

      {user && (
        <p className="mt-4 rounded-md bg-info-bg px-3 py-2 text-[13px] text-info-fg">
          You&apos;re signed in as {user.displayName || user.racfUserid}.{' '}
          <a className="underline" href={requested ?? BASE}>Continue</a>
        </p>
      )}
      {failed && (
        <div className="mt-4">
          <ErrorBanner error="Sign-in failed. Check your userid and passphrase. After too many wrong attempts your userid is revoked: ask an organizer." />
        </div>
      )}

      <form action={`${BASE}/process_login.html`} method="post" className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-[13px]">
          Userid
          <input
            className="input uppercase"
            name="username"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck="false"
            maxLength={8}
            defaultValue={params.get('userid') ?? ''}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          Passphrase
          <span className="relative flex">
            <input
              className="input pr-9"
              name="password"
              type={showPassphrase ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={100}
              required
            />
            <button
              type="button"
              className="absolute right-1 top-1 row-action"
              aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
              aria-pressed={showPassphrase}
              onClick={() => setShowPassphrase((v) => !v)}
            >
              <i className={`ti ${showPassphrase ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
            </button>
          </span>
        </label>
        <button type="submit" className="btn-primary justify-center">Sign in</button>
      </form>

      <div className="my-4 flex items-center gap-3 text-[12px] text-fg-3">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <button type="button" className="btn-secondary w-full justify-center" onClick={() => goTo(ORGANIZER_SIGN_IN_URL)}>
        <i className="ti ti-shield-lock" aria-hidden="true" />
        Organizer sign-in
      </button>

      <p className="mt-4 text-[13px] text-fg-2">
        No userid yet? <Link className="underline" to={PATHS.events}>Pick an event</Link> and register with its code.
      </p>
    </section>
  )
}
