export default function StatusBadge({ status }) {
  const label = status ? status[0] + status.slice(1).toLowerCase() : ''
  return <span className={'badge ' + String(status).toLowerCase()}>{label}</span>
}
