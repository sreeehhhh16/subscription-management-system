export function Logo({ light }) {
  return (
    <div className={'logo' + (light ? ' light' : '')}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="13" cy="13" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="48 16" strokeLinecap="round" />
        <circle cx="13" cy="13" r="3" fill="var(--gold)" />
      </svg>
      <span>Brightloop</span>
    </div>
  )
}
