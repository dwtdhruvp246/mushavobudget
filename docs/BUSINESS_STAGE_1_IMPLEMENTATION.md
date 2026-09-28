# Business Stage 1 — Application shell and workspace boundary

Stage 1 introduces the dedicated authenticated Business application without opening Business sales or provisioning.

## Delivered

- `business.html`, `business.css`, and `business.js` form a separate responsive Business application.
- Desktop navigation contains Overview, Activity & Transactions, Bills & Recurring, Requests & Approvals, Budgets, Reports, Team, Settings, and Subscription & Billing.
- Mobile navigation is limited to Overview, Activity, Add, Approvals, and More. The remaining sections are available through More.
- Existing authorized Business workspaces appear in the Personal/Family workspace selector and open the dedicated Business URL.
- The canonical route is `business.html?workspace=<workspace-id>#business/<section>`.
- Session, account-suspension, active membership, workspace ownership, and workspace type are checked before a Business workspace opens.
- Workspace selection is stored per authenticated user.
- Personal/Family financial state is cleared before navigation to Business.
- Business workspace state is cleared before each company load, and a request-sequence guard prevents a slow response from replacing the newly selected company.
- The Business shell reads only workspace, membership, subscription, entitlement, profile, and workspace-setting records. It does not read or write Personal/Family payments or Cashbook records.
- An expired or suspended Business subscription sends the Owner to Subscription & Billing for renewal access. Other members receive a locked-workspace message directing them to the Owner.
- Users without an authorized Business workspace see the staged-release coming-soon screen.

## Intentionally still closed

- Business plan purchase, pricing, seat selection, workspace creation, invitations, and member provisioning remain blocked by the Stage 0 database controls.
- Add actions are visible only as workflow previews and perform no database write.
- Financial totals and records are placeholders until the Business data model is added in the next stage.

## Database deployment

Stage 1 needs no new SQL. It uses the existing workspace, membership, subscription, entitlement, settings, and suspension controls established before this release.
