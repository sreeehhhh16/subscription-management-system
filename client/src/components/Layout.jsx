import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Logo } from './Logo'

// What each role sees in the sidebar
const NAV = {
  ADMIN: [
    ['/', 'Dashboard'],
    ['/subscriptions', 'Subscriptions'],
    ['/invoices', 'Invoices'],
    ['/payments', 'Payments'],
    ['/products', 'Products'],
    ['/plans', 'Plans'],
    ['/templates', 'Quotation templates'],
    ['/discounts', 'Discounts'],
    ['/taxes', 'Taxes'],
    ['/staff', 'Staff'],
  ],
  STAFF: [
    ['/', 'Dashboard'],
    ['/subscriptions', 'Subscriptions'],
    ['/invoices', 'Invoices'],
    ['/payments', 'Payments'],
  ],
  CUSTOMER: [
    ['/', 'Home'],
    ['/subscriptions', 'My subscriptions'],
    ['/invoices', 'My invoices'],
    ['/payments', 'Payment history'],
  ],
}

const ROLE_LABEL = { ADMIN: 'Admin', STAFF: 'Staff', CUSTOMER: 'Customer' }

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const onLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="shell">
      <header className="topbar">
        <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>
          Menu
        </button>
        <Logo light />
      </header>

      <nav className={'sidebar' + (open ? ' open' : '')}>
        <div className="sidebar-logo"><Logo light /></div>
        <ul>
          {(NAV[user.role] || []).map(([to, label]) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} onClick={() => setOpen(false)}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="sidebar-foot">
          <div className="who">
            <strong>{user.name || user.email}</strong>
            <span>{ROLE_LABEL[user.role]}</span>
          </div>
          <button className="btn ghost-light" onClick={onLogout}>Log out</button>
        </div>
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
