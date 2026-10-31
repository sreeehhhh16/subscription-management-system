import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import StatusBadge from '../components/StatusBadge'
import { money, shortDate } from '../format'

// Where each status can go next (the server enforces the same rules)
const NEXT = {
  DRAFT: ['QUOTATION', 'CLOSED'],
  QUOTATION: ['CONFIRMED', 'CLOSED'],
  CONFIRMED: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['CLOSED'],
  CLOSED: [],
}
const LABEL = { QUOTATION: 'Make quotation', CONFIRMED: 'Confirm', ACTIVE: 'Activate', CLOSED: 'Close' }

export default function SubscriptionDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const isCustomer = user.role === 'CUSTOMER'
  const [sub, setSub] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [tick, setTick] = useState(0)
  const reload = () => setTick((t) => t + 1)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api('/subscriptions/' + id),
      api('/invoices?subscriptionId=' + id + '&limit=100'),
    ])
      .then(([s, inv]) => {
        if (cancelled) return
        setSub(s)
        setInvoices(inv.items)
        setError('')
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [id, tick])


  const move = async (status) => {
    if (status === 'CLOSED' && !window.confirm('Close this subscription? This cannot be undone.')) return
    setBusy(true)
    try {
      const path = isCustomer ? '/cancel' : '/status'
      await api('/subscriptions/' + id + path, { method: 'POST', body: isCustomer ? {} : { status } })
      reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (error && !sub) return <div className="alert error" role="alert">{error}</div>
  if (!sub) return <p className="muted">Loading…</p>

  const next = isCustomer ? [] : NEXT[sub.status] || []
  const canClose = isCustomer && sub.status === 'ACTIVE' && sub.plan.allowEarlyClose

  return (
    <>
      <Link to="/subscriptions" className="back">← Back to subscriptions</Link>
      <div className="head-row">
        <h1>{sub.number}</h1>
        <StatusBadge status={sub.status} />
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      <div className="actions">
        {next.map((s) => (
          <button key={s} className={'btn ' + (s === 'CLOSED' ? 'danger' : 'primary')} disabled={busy} onClick={() => move(s)}>
            {LABEL[s]}
          </button>
        ))}
        {canClose && (
          <button className="btn danger" disabled={busy} onClick={() => move('CLOSED')}>Close subscription</button>
        )}
      </div>
      <dl className="details">
        {!isCustomer && <div><dt>Customer</dt><dd>{sub.customer.name || sub.customer.email}</dd></div>}
        <div><dt>Plan</dt><dd>{sub.plan.name}</dd></div>
        <div><dt>Billing</dt><dd>{sub.plan.billingPeriod.toLowerCase()}</dd></div>
        <div><dt>Start</dt><dd>{shortDate(sub.startDate)}</dd></div>
        <div><dt>Expires</dt><dd>{shortDate(sub.expiryDate)}</dd></div>
        <div><dt>Next billing</dt><dd>{shortDate(sub.nextBillingDate)}</dd></div>
        <div><dt>Payment terms</dt><dd>{sub.paymentTerms || '—'}</dd></div>
      </dl>
      <h2 className="section">Lines</h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th><th className="num">Qty</th><th className="num">Unit price</th>
              <th>Tax</th><th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sub.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.product.name}
                  {l.variant && <div className="muted small">{l.variant.attribute}: {l.variant.value}</div>}
                </td>
                <td className="num">{l.quantity}</td>
                <td className="num">{money(l.unitPrice)}</td>
                <td>{l.tax ? l.tax.name : '—'}</td>
                <td className="num">{money(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="section">Invoices</h2>
      {invoices.length === 0 ? (
        <p className="muted">No invoices yet. They are created on billing day.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th><th>Status</th><th>Due</th>
                <th className="num">Total</th><th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td><strong>{i.number}</strong></td>
                  <td><StatusBadge status={i.isOverdue ? 'OVERDUE' : i.status} /></td>
                  <td>{shortDate(i.dueDate)}</td>
                  <td className="num">{money(i.total)}</td>
                  <td className="num">{money(i.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
