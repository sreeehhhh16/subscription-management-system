import { Logo } from './Logo'

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <Logo light />
        <div className="auth-pitch">
          <div className="loop-art" aria-hidden="true">
            <span /><span /><span />
          </div>
          <h2>Every plan, invoice and payment in one place.</h2>
          <p>Renewals never get missed and nothing is billed twice.</p>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  )
}
