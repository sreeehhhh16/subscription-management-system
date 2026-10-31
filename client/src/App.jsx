import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Staff from './pages/Staff'
import ComingSoon from './pages/ComingSoon'
import Invoices from './pages/Invoices'
import SubscriptionDetail from './pages/SubscriptionDetail'
import Subscriptions from './pages/Subscriptions'

// Login and signup are only for people who are not logged in yet
function PublicOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="screen-center">Loading…</div>
  return user ? <Navigate to="/" replace /> : children
}

const ADMIN = ['ADMIN']

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />

        {/* Everyone logged in. Customers only get their own data from the API */}
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetail />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="payments" element={<ComingSoon title="Payments" note="Uses GET /api/payments" />} />

        {/* Admin only */}
        <Route path="products" element={<ProtectedRoute roles={ADMIN}><ComingSoon title="Products" note="Uses /api/products, with variants" /></ProtectedRoute>} />
        <Route path="plans" element={<ProtectedRoute roles={ADMIN}><ComingSoon title="Plans" note="Uses /api/plans" /></ProtectedRoute>} />
        <Route path="templates" element={<ProtectedRoute roles={ADMIN}><ComingSoon title="Quotation templates" note="Needs backend routes first" /></ProtectedRoute>} />
        <Route path="discounts" element={<ProtectedRoute roles={ADMIN}><ComingSoon title="Discounts" note="Needs backend routes first" /></ProtectedRoute>} />
        <Route path="taxes" element={<ProtectedRoute roles={ADMIN}><ComingSoon title="Taxes" note="Uses /api/taxes" /></ProtectedRoute>} />
        <Route path="staff" element={<ProtectedRoute roles={ADMIN}><Staff /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
