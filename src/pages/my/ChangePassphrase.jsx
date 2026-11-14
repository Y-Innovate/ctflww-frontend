import { useState } from 'react'
import { changePassphrase } from '../../api/player'
import ErrorBanner from '../../components/ErrorBanner'
import Field from '../../components/Field'

const MIN_LENGTH = 14
const EMPTY = { currentPassphrase: '', newPassphrase: '', repeat: '' }

// P3: RACF checks the current passphrase and its rules for the new one. The
// fields are cleared after every attempt; nothing is kept.
export default function ChangePassphrase() {
  const [values, setValues] = useState(EMPTY)
  const [state, setState] = useState({ busy: false, error: null, done: false })

  const set = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }))
  const mismatch = values.repeat && values.newPassphrase !== values.repeat
  const short = values.newPassphrase && values.newPassphrase.length < MIN_LENGTH

  async function submit(e) {
    e.preventDefault()
    if (mismatch || short) return
    setState({ busy: true, error: null, done: false })
    try {
      await changePassphrase({ currentPassphrase: values.currentPassphrase, newPassphrase: values.newPassphrase })
      setState({ busy: false, error: null, done: true })
    } catch (err) {
      setState({ busy: false, error: err, done: false })
    }
    setValues(EMPTY)
  }

  return (
    <section className="card flex flex-col gap-3 p-6">
      <h2 className="text-[15px] font-medium">Change your passphrase</h2>
      <p className="text-[13px] text-fg-2">It changes on the mainframe too: use the new one there from now on.</p>
      {state.done && (
        <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-[13px] text-success-fg">
          Your passphrase is changed.
        </p>
      )}
      {state.error && (
        <ErrorBanner error={state.error.isPassphraseRefused
          ? 'The current passphrase is wrong, or the mainframe refused the new one.'
          : state.error} />
      )}
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <Field label="Current passphrase" name="currentPassphrase" type="password" value={values.currentPassphrase}
          onChange={set} required maxLength={100} autoComplete="current-password" />
        <Field label="New passphrase" name="newPassphrase" type="password" value={values.newPassphrase} onChange={set}
          required maxLength={100} autoComplete="new-password" hint={`At least ${MIN_LENGTH} characters.`}
          error={short ? `At least ${MIN_LENGTH} characters, please.` : null} />
        <Field label="New passphrase again" name="repeat" type="password" value={values.repeat} onChange={set}
          required maxLength={100} autoComplete="new-password" error={mismatch ? 'The two passphrases differ.' : null} />
        <button type="submit" className="btn-primary self-start" disabled={state.busy}>
          {state.busy ? 'Saving…' : 'Change passphrase'}
        </button>
      </form>
    </section>
  )
}
