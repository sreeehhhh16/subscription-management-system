// Same rule as the server (utils/password.js), shown live while typing
export const passwordChecks = (p) => [
  { label: 'More than 8 characters', ok: p.length > 8 },
  { label: 'An uppercase letter', ok: /[A-Z]/.test(p) },
  { label: 'A lowercase letter', ok: /[a-z]/.test(p) },
  { label: 'A special character', ok: /[^A-Za-z0-9]/.test(p) },
]

export const isStrongPassword = (p) => passwordChecks(p).every((c) => c.ok)

export default function PasswordRules({ password }) {
  return (
    <ul className="rules" aria-live="polite">
      {passwordChecks(password).map((c) => (
        <li key={c.label} className={c.ok ? 'ok' : ''}>
          <span aria-hidden="true">{c.ok ? '✓' : '○'}</span> {c.label}
        </li>
      ))}
    </ul>
  )
}
