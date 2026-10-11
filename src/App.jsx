import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { useOnline } from './lib/useOnline'
import BottomNav from './components/BottomNav'
import Page from './components/Page'
import SignIn from './screens/SignIn'
import Setup from './screens/Setup'
import Join from './screens/Join'
import Library from './screens/Library'
import Settings from './screens/Settings'
import ComingSoon from './screens/ComingSoon'

function NotConfigured() {
  return (
    <Page title="Almost ready">
      <p>
        The app needs its Supabase settings. Add <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> as environment variables, then redeploy.
      </p>
    </Page>
  )
}

function Shell() {
  const { session, member, loading } = useAuth()
  const online = useOnline()

  if (loading) {
    return (
      <main id="main" className="page">
        <p role="status">Opening your kitchen…</p>
      </main>
    )
  }

  // Invite links work whether or not someone is signed in.
  const joinRoute = <Route path="/join/:code" element={<Join />} />

  if (!session) {
    return (
      <Routes>
        {joinRoute}
        <Route path="*" element={<SignIn />} />
      </Routes>
    )
  }

  if (!member) {
    return (
      <Routes>
        {joinRoute}
        <Route path="*" element={<Setup />} />
      </Routes>
    )
  }

  return (
    <>
      {!online && (
        <p className="offline-banner" role="status">
          You're offline. Recipes still work; changes sync when you reconnect.
        </p>
      )}
      <Routes>
        {joinRoute}
        <Route path="/" element={<Library />} />
        <Route
          path="/import"
          element={
            <ComingSoon
              title="Import"
              description="Add a recipe from a screenshot, PDF, link, or pasted text."
            />
          }
        />
        <Route
          path="/stats"
          element={
            <ComingSoon
              title="Stats"
              description="What you cook most, your favorite cuisines, and hours cooked together."
            />
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route
          path="*"
          element={<ComingSoon title="Not found" description="That page doesn't exist." />}
        />
      </Routes>
      <BottomNav />
    </>
  )
}

export default function App() {
  if (!isConfigured) return <NotConfigured />
  return (
    <BrowserRouter>
      <a className="skip-link btn" href="#main">
        Skip to content
      </a>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  )
}
