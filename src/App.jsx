import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { useOnline } from './lib/useOnline'
import BottomNav from './components/BottomNav'
import UpdateBanner from './components/UpdateBanner'
import WhatsNew from './components/WhatsNew'
import BadgeUnlock from './components/BadgeUnlock'
import MyColor from './components/MyColor'
import Page from './components/Page'
import SignIn from './screens/SignIn'
import Setup, { setupPending } from './screens/Setup'
import Join from './screens/Join'
import Library from './screens/Library'
import Settings from './screens/Settings'
import ComingSoon from './screens/ComingSoon'
import Import from './screens/Import'
import RecipeView from './screens/RecipeView'
import RecipeEdit from './screens/RecipeEdit'
import CookingMode from './screens/CookingMode'
import TwoChef from './screens/TwoChef'
import Stats, { BadgesPage } from './screens/Stats'
import Closet from './screens/Closet'
import NoteEdit from './screens/NoteEdit'
import { startSync } from './lib/sync'

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
  const { pathname } = useLocation()
  // Cooking mode uses the bottom of the screen for its step buttons.
  const cooking = pathname.endsWith('/cook') || pathname.endsWith('/two-chef')
  const kitchenId = member?.kitchen_id

  // Keep this phone in sync with the kitchen while signed in.
  useEffect(() => {
    if (!kitchenId) return undefined
    return startSync()
  }, [kitchenId])

  if (loading) {
    return (
      <main id="main" className="page">
        <h1 className="sr-only">Our Kitchen</h1>
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

  // No kitchen yet, or part-way through setup (the kitchen is made at step
  // 2, and the last steps still follow).
  if (!member || setupPending(session.user.id)) {
    return (
      <Routes>
        {joinRoute}
        <Route path="*" element={<Setup />} />
      </Routes>
    )
  }

  return (
    <>
      <WhatsNew />
      <BadgeUnlock />
      <MyColor />
      {!online && (
        <p className="offline-banner" role="status">
          You're offline. Recipes still work; changes sync when you reconnect.
        </p>
      )}
      <Routes>
        {joinRoute}
        <Route path="/" element={<Library />} />
        <Route path="/import" element={<Import />} />
        <Route path="/recipe/new" element={<RecipeEdit />} />
        <Route path="/recipe/:id" element={<RecipeView />} />
        <Route path="/recipe/:id/edit" element={<RecipeEdit />} />
        <Route path="/recipe/:id/cook" element={<CookingMode />} />
        <Route path="/recipe/:id/two-chef" element={<TwoChef />} />
        <Route path="/recipe/:id/note/:noteId" element={<NoteEdit />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/badges" element={<BadgesPage />} />
        <Route path="/avatar" element={<Closet />} />
        <Route path="/settings" element={<Settings />} />
        <Route
          path="*"
          element={<ComingSoon title="Not found" description="That page doesn't exist." />}
        />
      </Routes>
      {!cooking && <BottomNav />}
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
      <UpdateBanner />
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  )
}
