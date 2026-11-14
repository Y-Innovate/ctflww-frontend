import { useSearchParams } from 'react-router'
import EventDetail from './EventDetail'
import EventList from './EventList'

// The start page /ctf (V1): the events, or one event with ?eventID=
export default function Events() {
  const [params] = useSearchParams()
  const eventID = params.get('eventID')
  return eventID ? <EventDetail key={eventID} eventID={eventID} /> : <EventList />
}
