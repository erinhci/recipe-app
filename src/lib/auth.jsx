import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getMeta, setMeta } from './db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadMember = useCallback(async (userId) => {
    if (!userId) {
      setMember(null)
      return
    }
    if (navigator.onLine) {
      const { data, error } = await supabase
        .from('members')
        .select('user_id, kitchen_id, display_name, unit_pref')
        .eq('user_id', userId)
        .maybeSingle()
      if (!error) {
        setMember(data)
        await setMeta('member', data)
        return
      }
    }
    // Offline (or the request failed): use the copy saved on this phone.
    const cached = await getMeta('member')
    setMember(cached?.user_id === userId ? cached : null)
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadMember(data.session?.user.id)
      if (active) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      loadMember(next?.user.id)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadMember])

  const refreshMember = useCallback(
    () => loadMember(session?.user.id),
    [loadMember, session],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    await setMeta('member', null)
    setMember(null)
  }, [])

  return (
    <AuthContext.Provider value={{ session, member, loading, refreshMember, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
