import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import AuthLayout from '../components/AuthLayout'
import PasswordRules, { isStrongPassword } from '../components/PasswordRules'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!isStrongPassword(password)) {
      setError('Your password does not meet all the rules below yet.')
      return
    }
    setBusy(true)
    try {
      const data = await api('/auth/reset-password', { method: 'POST', body: { token, password } })
      setMessage(data.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Link not valid">
        <div className="alert error">This reset link is missing its token. Request a new one.</div>
        <p className="auth-links"><Link to="/forgot-password">Request a new link</Link></p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Choose a new password">
      {message ? (
        <>
          <div className="alert success" role="status">{message}</div>
          <p className="auth-links"><Link to="/login">Go to log in</Link></p>
        </>
      ) : (
        <form onSubmit={submit} className="form">
          {error && <div className="alert error" role="alert">{error}</div>}
          <label>
            New password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required autoFocus />
          </label>
          <PasswordRules password={password} />
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
        </form>
      )}
    </AuthLayout>
  )
}
