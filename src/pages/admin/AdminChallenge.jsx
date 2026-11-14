import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  adminEvents, createChallenge, deleteChallenge, eventChallenges, flags, getLibraryChallenge, hints, links,
  updateChallenge,
} from '../../api/admin'
import ConfirmButton from '../../components/ConfirmButton'
import ErrorBanner from '../../components/ErrorBanner'
import { isYes } from '../../lib/codes'
import { ADMIN_PATHS, linkTo } from '../../routes'
import ChallengeForm from './challenge/ChallengeForm'
import ItemsEditor from './challenge/ItemsEditor'
import { useCategories } from './useCategories'

// A2: a library challenge with its flags, hints and links; without
// challengeID the form for a new one
export default function AdminChallenge() {
  const [params] = useSearchParams()
  const challengeID = params.get('challengeID')
  return challengeID ? <ChallengePage key={challengeID} challengeID={challengeID} /> : <NewChallenge />
}

const back = <Link className="text-[13px] text-fg-2 underline" to={ADMIN_PATHS.library}>Library</Link>

function NewChallenge() {
  const navigate = useNavigate()
  const categories = useCategories()
  return (
    <section className="flex flex-col gap-4">
      {back}
      <h1 className="text-[17px] font-medium">New challenge</h1>
      <p className="text-[13px] text-fg-2">Flags, hints and links follow once the challenge exists.</p>
      <ChallengeForm challenge={null} categories={categories} submitLabel="Create challenge"
        onSubmit={async (values) => {
          const created = await createChallenge(values)
          navigate(linkTo(ADMIN_PATHS.challenge, { challengeID: created.challengeID }), { replace: true })
        }} />
    </section>
  )
}

// The running (or frozen) events that use a challenge: changes apply there
// at once. The backend can't list the events of a challenge, so this asks
// each running event for its challenges; there are only a few.
function useRunningEventsWith(challengeID) {
  const [names, setNames] = useState([])
  useEffect(() => {
    let alive = true
    adminEvents.listAll({ eventStatus_filter: 'P' })
      .then((events) => Promise.all(events.filter((e) => e.phase === 'R' || e.phase === 'F').map((e) =>
        eventChallenges.listAll({ eventID: e.eventID })
          .then((rows) => (rows.some((r) => String(r.challengeID) === String(challengeID)) ? e.eventName : null)))))
      .then((found) => alive && setNames(found.filter(Boolean)), () => {})
    return () => {
      alive = false
    }
  }, [challengeID])
  return names
}

function useChallenge(challengeID) {
  const [state, setState] = useState({ challenge: null, error: null })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let alive = true
    getLibraryChallenge(challengeID).then(
      (challenge) => alive && setState({ challenge, error: null }),
      (error) => alive && setState({ challenge: null, error }),
    )
    return () => {
      alive = false
    }
  }, [challengeID, version])
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}

const FLAG_FIELDS = [
  { name: 'flagValue', label: 'Flag', kind: 'text', max: 255, required: true, mono: true },
  { name: 'caseSensitive', label: 'Case sensitive', kind: 'yesno' },
]
const HINT_FIELDS = [
  { name: 'sortOrder', label: 'Order', kind: 'number', min: 0, initial: '1' },
  { name: 'cost', label: 'Cost (points)', kind: 'number', min: 0, initial: '0' },
  { name: 'hintText', label: 'Text', kind: 'textarea', max: 1000, required: true },
]
const LINK_FIELDS = [
  { name: 'linkName', label: 'Name', kind: 'text', max: 60, required: true },
  { name: 'linkUrl', label: 'URL', kind: 'text', max: 500, required: true, mono: true },
]

const inUse = (err) => (err.isWrongState && err.infoMessage ? `${err.infoMessage}.` : err)

function ChallengePage({ challengeID }) {
  const { challenge, error, reload } = useChallenge(challengeID)
  const categories = useCategories()
  const running = useRunningEventsWith(challengeID)
  const navigate = useNavigate()
  const [deleteError, setDeleteError] = useState(null)

  if (error) {
    return (
      <section className="flex flex-col gap-4">
        {back}
        {error.isNotFound ? <p className="card p-6 text-fg-2">This challenge doesn&apos;t exist (any more).</p> : <ErrorBanner error={error} />}
      </section>
    )
  }
  if (!challenge) return back

  async function remove() {
    setDeleteError(null)
    try {
      await deleteChallenge(challengeID)
      navigate(ADMIN_PATHS.library, { replace: true })
    } catch (err) {
      setDeleteError(inUse(err))
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {back}
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-[19px] font-medium">{challenge.challengeTitle}</h1>
        <span className="text-[12px] text-fg-3">Challenge {challenge.challengeID}</span>
      </header>
      {running.length > 0 && (
        <p role="note" className="rounded-md bg-warning-bg px-4 py-2.5 text-[13px] text-warning-fg">
          <i className="ti ti-alert-triangle mr-1.5" aria-hidden="true" />
          Running now in {running.join(', ')}: changes apply there at once. A changed flag doesn&apos;t undo solves.
        </p>
      )}
      <ChallengeForm challenge={challenge} categories={categories} submitLabel="Save"
        onSubmit={async (values) => {
          await updateChallenge(challengeID, values)
          reload()
        }} />

      <ItemsEditor title="Flags" singular="flag" resource={flags} challengeID={challengeID} fields={FLAG_FIELDS}
        errorText={inUse}
        summary={(f) => (
          <span className="flex flex-wrap items-center gap-2">
            <code className="break-all font-mono">{f.flagValue}</code>
            <span className="text-[11px] text-fg-3">{isYes(f.caseSensitive) ? 'case sensitive' : 'ignores case'}</span>
          </span>
        )} />
      <ItemsEditor title="Hints" singular="hint" resource={hints} challengeID={challengeID} fields={HINT_FIELDS}
        errorText={inUse} sort={(a, b) => a.sortOrder - b.sortOrder || a.hintID - b.hintID}
        summary={(h) => (
          <>
            <div className="text-[11px] text-fg-3">Order {h.sortOrder} · costs {h.cost} points</div>
            <p className="whitespace-pre-line">{h.hintText}</p>
          </>
        )} />
      <ItemsEditor title="Links" singular="link" resource={links} challengeID={challengeID} fields={LINK_FIELDS}
        summary={(l) => (
          <span className="flex flex-col">
            <span className="font-medium">{l.linkName}</span>
            <span className="break-all font-mono text-[12px] text-fg-2">{l.linkUrl}</span>
          </span>
        )} />

      <section className="card flex flex-col gap-3 p-6" aria-labelledby="delete-title">
        <h2 id="delete-title" className="text-[15px] font-medium">Delete</h2>
        <p className="text-[13px] text-fg-2">Only a challenge that no event uses; its flags, hints and links go with it.</p>
        {deleteError && <ErrorBanner error={deleteError} />}
        <div>
          <ConfirmButton label="Delete challenge" icon="ti-trash" danger confirmLabel="Delete"
            question="Delete this challenge with its flags, hints and links?" onConfirm={remove} />
        </div>
      </section>
    </section>
  )
}
