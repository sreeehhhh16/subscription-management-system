import { useState } from 'react'
import { api } from '../api'
import PasswordRules, { isStrongPassword } from '../components/PasswordRules'

export default function Staff() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!isStrongPassword(form.password)) {
      setError('The password does not meet all the rules below yet.')
      return
    }
    setBusy(true)
    try {
      const u = await api('/users/staff', { method: 'POST', body: form })
      setMessage(`${u.email} can now log in as staff.`)
      setForm({ name: '', email: '', password: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head"><h1>Staff</h1></div>
      <p className="muted">Add a team member who can manage customers, subscriptions, invoices and payments.</p>
      <form onSubmit={submit} className="form panel narrow">
        {error && <div className="alert error" role="alert">{error}</div>}
        {message && <div className="alert success" role="status">{message}</div>}
        <label>Full name<input value={form.name} onChange={set('name')} /></label>
        <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Temporary password<input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required /></label>
        <PasswordRules password={form.password} />
        <button className="btn primary" disabled={busy}>{busy ? 'Adding…' : 'Add staff member'}</button>
      </form>
    </>
  )
}
