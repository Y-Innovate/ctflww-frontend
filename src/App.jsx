import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import AdminRoute from './components/AdminRoute'
import Layout from './components/Layout'
import PlayerRoute from './components/PlayerRoute'
import { SessionProvider } from './context/SessionContext'
import Announcements from './pages/Announcements'
import Board from './pages/Board'
import Challenge from './pages/Challenge'
import Events from './pages/Events'
import Leaderboard from './pages/Leaderboard'
import Login from './pages/Login'
import MyEvents from './pages/MyEvents'
import NotFound from './pages/NotFound'
import Register from './pages/Register'
import Team from './pages/Team'

// The admin pages, in a chunk of their own that loads on first use
const AdminApp = lazy(() => import('./pages/admin/AdminApp'))

// Paths: src/routes.js
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Events />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="register" element={<Register />} />
        <Route path="login" element={<Login />} />
        <Route element={<PlayerRoute />}>
          <Route path="my" element={<MyEvents />} />
          <Route path="board" element={<Board />} />
          <Route path="challenge" element={<Challenge />} />
          <Route path="team" element={<Team />} />
          <Route path="announcements" element={<Announcements />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="admin/*" element={<AdminApp />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/ctf">
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  )
}
