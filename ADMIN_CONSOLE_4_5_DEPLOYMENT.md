# Mushavo Budget 4.5 admin console deployment

This release compacts the admin console, corrects dashboard subscription reporting,
groups workspaces by owner, keeps the complete plan catalogue visible, and adds
role-protected customer support tickets.

## Required order

1. Merge the reviewed web release.
2. Before testing the new Support pages, apply only:
   `supabase/migrations/20260912120000_support_ticket_workflow.sql`
3. Run `supabase/admin-console-4-5-diagnostic.sql`.
4. Confirm all eight diagnostic columns return `true`.
5. Allow the web deployment to finish, then accept the Version 4.5.0 update.

The migration is additive. It does not delete or modify legacy
`admin_support_notes`, budget payments, subscription payments, workspaces, plans,
notifications, or the push-notification schedule.

## Focused verification

- Clicking either authenticated logo opens the correct Dashboard.
- Dashboard shows registered users, active paid subscriptions, expiries within 30
  days, pending payment reviews, active workspaces, and subscription revenue.
- Recent Platform Finance includes subscription-payment submissions.
- Workspaces are grouped once per owner with expandable Personal, Family, and
  Business sections only when those types exist.
- User rows stay compact until expanded.
- Plans shows the complete catalogue before the collapsed editors.
- Finance settings and legacy records stay collapsed by default.
- Enquiry counters show two per row where space allows and each enquiry expands.
- A customer can create and reply to their own ticket, but cannot see internal
  notes or another customer's ticket.
- Support/Admin staff can assign, prioritize, reply to, and resolve tickets.

## Release markers

- App version: `4.5.0`
- App module: `app.js?v=66`
- Stylesheet: `styles.css?v=53`
- Service worker cache: `pwa-shell-v22`
