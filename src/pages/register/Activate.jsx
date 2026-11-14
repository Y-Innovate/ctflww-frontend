import { useState } from 'react'
import { activate } from '../../api/registration'
import ErrorBanner from '../../components/ErrorBanner'
import Field from '../../components/Field'

const MIN_LENGTH = 14

// R3: claim token and the passphrase twice. RACF has the last word on the
// passphrase; its refusal is shown and the registrant can try again. The
// fields are cleared after every attempt.
export default function Activate({ registrationID, claimToken, onDone }) {
  const [values, setValues] = useState({ claimToken, passphrase: '', repeat: '' })
  const [state, setState] = useState({ busy: false, error: null })

  const set = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }))
  const mismatch = values.repeat && values.passphrase !== values.repeat
  const short = values.passphrase && values.passphrase.length < MIN_LENGTH

  async function submit(e) {
    e.preventDefault()
    if (mismatch || short) return
    setState({ busy: true, error: null })
    try {
      const r = await activate(registrationID, { claimToken: values.claimToken.trim(), passphrase: values.passphrase })
      setValues({ claimToken: '', passphrase: '', repeat: '' })
      onDone(r.racfUserid)
    } catch (err) {
      setValues((v) => ({ ...v, passphrase: '', repeat: '' }))
      setState({ busy: false, error: err })
    }
  }

  return (
    <form className="card flex flex-col gap-3 p-6" onSubmit={submit}>
      <div>
        <h1 className="text-[17px] font-medium">Choose your passphrase</h1>
        <p className="mt-1 text-[13px] text-fg-2">Your userid is ready. Choose the passphrase you&apos;ll sign in with.</p>
      </div>
      {state.error && <ErrorBanner error={activateError(state.error)} />}
      <Field label="Claim token" name="claimToken" value={values.claimToken} onChange={set} required
        autoComplete="off" spellCheck="false" className="input font-mono uppercase" />
      <Field label="Passphrase" name="passphrase" type="password" value={values.passphrase} onChange={set} required
        maxLength={100} autoComplete="new-password"
        hint={`At least ${MIN_LENGTH} characters. A few words with spaces work well.`}
        error={short ? `At least ${MIN_LENGTH} characters, please.` : null} />
      <Field label="Passphrase again" name="repeat" type="password" value={values.repeat} onChange={set} required
        maxLength={100} autoComplete="new-password" error={mismatch ? 'The two passphrases differ.' : null} />
      <button type="submit" className="btn-primary justify-center" disabled={state.busy}>
        {state.busy ? 'Saving…' : 'Save passphrase'}
      </button>
    </form>
  )
}

function activateError(err) {
  if (err.isWrongClaimToken) return 'That claim token is wrong, or has expired.'
  if (err.isPassphraseRefused) return `The mainframe refused this passphrase. ${err.infoMessage}`.trim()
  return err
}
