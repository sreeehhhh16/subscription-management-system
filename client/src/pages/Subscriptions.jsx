import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import StatusBadge from '../components/StatusBadge'
import Pager from '../components/Pager'
import { money, shortDate } from '../format'

const STATUSES = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED']

export default function Subscriptions() {
  const { user } = useAuth()
  const isCustomer = user.role === 'CUSTOMER'
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page, limit: 20 })
    if (status) params.set('status', status)
    if (query) params.set('search', query)
    api('/subscriptions?' + params)
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError('')
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [status, query, page])

  return (
    <>
      <div className="page-head"><h1>{isCustomer ? 'My subscriptions' : 'Subscriptions'}</h1></div>
      <div className="toolbar">
        <input
          type="search"
          placeholder={isCustomer ? 'Search by number' : 'Search by number, name or email'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && data.items.length === 0 && (
        <div className="empty"><strong>No subscriptions found.</strong></div>
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Number</th>
                  {!isCustomer && <th>Customer</th>}
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>Expires</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={"/subscriptions/" + s.id}><strong>{s.number}</strong></Link></td>
                    {!isCustomer && (
                      <td>
                        {s.customer.name || s.customer.email}
                        <div className="muted small">{s.customer.email}</div>
                      </td>
                    )}
                    <td>
                      {s.plan.name}
                      <div className="muted small">{s.plan.billingPeriod.toLowerCase()}</div>
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>{shortDate(s.startDate)}</td>
                    <td>{shortDate(s.expiryDate)}</td>
                    <td className="num">{money(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  )
}
