// Stand-in for pages we have not built yet. Replace one route at a time.
export default function ComingSoon({ title, note }) {
  return (
    <>
      <div className="page-head"><h1>{title}</h1></div>
      <div className="empty">
        <strong>This page is next on the list.</strong>
        {note && <span>{note}</span>}
      </div>
    </>
  )
}
