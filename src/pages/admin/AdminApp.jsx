import { Route, Routes } from 'react-router'
import NotFound from '../NotFound'
import AdminChallenge from './AdminChallenge'
import AdminEvent from './AdminEvent'
import AdminEvents from './AdminEvents'
import AdminLayout from './AdminLayout'
import AdminPlayer from './AdminPlayer'
import Jobs from './Jobs'
import Library from './Library'
import Players from './Players'
import Settings from './Settings'

// The organizers' pages under /ctf/admin (PLAN-ADMIN.md). App.jsx loads this
// module lazily, so everything it imports goes into one chunk that players
// never download. Paths: ADMIN_PATHS in src/routes.js.
export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminEvents />} />
        <Route path="event" element={<AdminEvent />} />
        <Route path="library" element={<Library />} />
        <Route path="challenge" element={<AdminChallenge />} />
        <Route path="players" element={<Players />} />
        <Route path="player" element={<AdminPlayer />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
