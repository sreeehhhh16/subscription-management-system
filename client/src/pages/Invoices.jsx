import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'
import StatusBadge from '../components/StatusBadge'
import Pager from '../components/Pager'
import { money, shortDate } from '../format'

const STATUSES = ['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED', 'OVERDUE']

export default function Invoices() {
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
    if (status === 'OVERDUE') params.set('overdue', 'true')
    else if (status) params.set('status', status)
    if (query) params.set('search', query)
    api('/invoices?' + params)
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
      <div className="page-head"><h1>{isCustomer ? 'My invoices' : 'Invoices'}</h1></div>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by invoice number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All invoices</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && data.items.length === 0 && (
        <div className="empty"><strong>No invoices found.</strong></div>
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  {!isCustomer && <th>Customer</th>}
                  <th>Subscription</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th className="num">Total</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.number}</strong></td>
                    {!isCustomer && (
                      <td>{i.subscription.customer.name || i.subscription.customer.email}</td>
                    )}
                    <td>{i.subscription.number}</td>
                    <td><StatusBadge status={i.isOverdue ? 'OVERDUE' : i.status} /></td>
                    <td>{shortDate(i.dueDate)}</td>
                    <td className="num">{money(i.total)}</td>
                    <td className="num">{money(i.balance)}</td>
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
