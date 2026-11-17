import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

type AuthState = {
  session: Session | null
  loading: boolean
  hasUsers: boolean | undefined
  refetchHasUsers: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const hasUsersQuery = useQuery({
    queryKey: ['app_has_users'],
    enabled: !sessionLoading && !session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('app_has_users')
      if (error) throw error
      return data as boolean
    },
    refetchInterval: (q) => (q.state.data === false ? 5000 : false),
  })

  const value: AuthState = {
    session,
    loading: sessionLoading || (!session && hasUsersQuery.isLoading),
    hasUsers: session ? true : hasUsersQuery.data,
    refetchHasUsers: () => void hasUsersQuery.refetch(),
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
