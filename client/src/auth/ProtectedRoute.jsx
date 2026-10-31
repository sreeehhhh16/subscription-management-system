import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

// roles is optional: <ProtectedRoute roles={['ADMIN']}> limits a page to the admin
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="screen-center">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}
