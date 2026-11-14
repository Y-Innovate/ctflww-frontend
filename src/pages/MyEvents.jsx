import { useSearchParams } from 'react-router'
import { myEvents } from '../api/lists'
import { usePagedList } from '../hooks/usePagedList'
import ChangePassphrase from './my/ChangePassphrase'
import JoinEvent from './my/JoinEvent'
import MyEventList from './my/MyEventList'

const NO_FILTERS = {}

// P2, P3, P8: the player's events, joining another one, and the passphrase.
// ?join=<eventID> preselects an event to join (from an event's page).
export default function MyEvents() {
  const [params] = useSearchParams()
  const list = usePagedList(myEvents, NO_FILTERS)

  return (
    <div className="flex flex-col gap-6">
      <MyEventList list={list} />
      <JoinEvent joined={list.rows} preselect={params.get('join')} onJoined={list.reload} />
      <ChangePassphrase />
    </div>
  )
}
