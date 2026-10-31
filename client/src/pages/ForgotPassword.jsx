import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import AuthLayout from '../components/AuthLayout'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await api('/auth/forgot-password', { method: 'POST', body: { email } })
      setMessage(data.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll send a reset link to your registered email.">
      {message ? (
        <div className="alert success" role="status">{message}</div>
      ) : (
        <form onSubmit={submit} className="form">
          {error && <div className="alert error" role="alert">{error}</div>}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p className="auth-links"><Link to="/login">Back to log in</Link></p>
    </AuthLayout>
  )
}
