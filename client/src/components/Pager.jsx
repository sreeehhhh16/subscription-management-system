export default function Pager({ page, pages, total, onPage }) {
  return (
    <div className="pager">
      <span className="muted">{total} total</span>
      <div>
        <button className="btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button className="btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  )
}
