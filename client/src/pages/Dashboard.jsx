import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const LINKS = {
  ADMIN: [
    ['/subscriptions', 'Subscriptions', 'See where every subscription stands.'],
    ['/invoices', 'Invoices', 'Generate, confirm and send invoices.'],
    ['/payments', 'Payments', 'Record payments and chase overdue invoices.'],
    ['/plans', 'Plans', 'Set prices, billing periods and availability.'],
  ],
  STAFF: [
    ['/subscriptions', 'Subscriptions', 'Create and track customer subscriptions.'],
    ['/invoices', 'Invoices', 'Generate, confirm and send invoices.'],
    ['/payments', 'Payments', 'Record payments and chase overdue invoices.'],
  ],
  CUSTOMER: [
    ['/subscriptions', 'My subscriptions', 'Check what you are subscribed to.'],
    ['/invoices', 'My invoices', 'View and print your invoices.'],
    ['/payments', 'Payment history', 'See the payments you have made.'],
  ],
}

export default function Dashboard() {
  const { user } = useAuth()
  return (
    <>
      <div className="page-head">
        <h1>Hello, {user.name || user.email}</h1>
      </div>
      <p className="muted">
        {user.role === 'CUSTOMER'
          ? 'Everything about your subscriptions lives here.'
          : 'Pick up where you left off.'}
      </p>
      <div className="tiles">
        {LINKS[user.role].map(([to, title, text]) => (
          <Link key={to} to={to} className="tile">
            <strong>{title}</strong>
            <span>{text}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
