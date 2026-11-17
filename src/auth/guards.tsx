import { Navigate, Outlet } from 'react-router'
import { Spinner } from '../components/ui'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { session, loading, hasUsers } = useAuth()
  if (loading) return <Spinner />
  if (session) return <Outlet />
  if (hasUsers === false) return <Navigate to="/setup" replace />
  return <Navigate to="/login" replace />
}

export function PublicOnly() {
  const { session, loading } = useAuth()
  if (loading) return <Spinner />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
