// Every list endpoint answers { items, total, page, limit, pages } so pages stay fast with thousands of rows
function parsePage(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

function pageResult(items, total, { page, limit }) {
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

// from/to query values -> a Prisma date filter. A date-only "to" includes that whole day.
function dateFilter(from, to) {
  const f = {};
  if (from) {
    const d = new Date(from);
    if (isNaN(d)) return { error: "from must be a valid date" };
    f.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (isNaN(d)) return { error: "to must be a valid date" };
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(to))) d.setUTCHours(23, 59, 59, 999);
    f.lte = d;
  }
  return { filter: Object.keys(f).length ? f : undefined };
}

module.exports = { parsePage, pageResult, dateFilter };
