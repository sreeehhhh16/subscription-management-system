# Brightloop API

All routes need `Authorization: Bearer <token>` except `/api/auth/*`.
Lists answer `{ items, total, page, limit, pages }` and accept `?page=1&limit=20` (limit max 100).
Roles: A = admin, S = staff, C = customer (sees only their own data).

## Auth
POST /api/auth/signup | login | forgot-password | reset-password

## Users
GET  /api/users/me                      all
GET  /api/users?role=CUSTOMER&search=   A,S   (role=STAFF: A only)
POST /api/users/staff                   A
POST /api/users/customers               A,S

## Catalog (A writes, everyone logged in reads)
/api/products (+ /:id/variants), /api/plans (+ /:id/close|pause|renew), /api/taxes (isDefault = auto tax)
/api/discounts                          A writes, A,S read.  type PERCENT|FIXED
/api/templates                          A writes, A,S read
POST /api/templates/:id/create-subscription   A,S   { customerId, startDate, expiryDate?, paymentTerms? }

## Subscriptions
GET  /api/subscriptions?status=&search=&planId=&customerId=
POST /api/subscriptions                 A,S
POST /api/subscriptions/:id/status      A,S   { status }
POST /api/subscriptions/:id/cancel      C     (own, plan must allow early close)

## Invoices
GET  /api/invoices?status=&overdue=true&search=&from=&to=&customerId=&subscriptionId=
GET  /api/invoices/:id                  (includes paidAmount, balance, isOverdue)
POST /api/invoices/generate             A,S   { asOf? }
POST /api/invoices/:id/status           A,S   { status: CONFIRMED | CANCELLED }
POST /api/invoices/:id/send             A,S

## Payments
POST /api/payments                      A,S   { invoiceId, method, amount, paidAt?, note? }
GET  /api/payments?method=&invoiceId=&from=&to=
GET  /api/payments/outstanding | /overdue      A,S

## Reports (A,S)
GET /api/reports/summary?from=&to=
GET /api/reports/revenue-by-month?months=12
