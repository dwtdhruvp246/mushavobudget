# FR.3.1 decisions for account deletion

**Stage 4/10 · FR.3/8 · FR.3.1 → FR.3.3 · Proposed for owner review**

The request API records a pending case. The rules below would govern processing once adopted and verified. The machine-readable [retention decision register](security-stage-4-retention-decisions.json) holds the current approval state.

## Workspace ownership

**Owner decision recorded on 16 November 2026.** When permanent account deletion completes, automatically close and delete the Family and Business workspaces the departing account owns. Warn the owner by listing those workspaces before confirming the request.

| Account situation | Proposed handling |
| --- | --- |
| Owns a Personal workspace | Erase its payments, cashbook, settings and exclusively personal attachments with the account. Handle platform subscription and billing records under the adopted billing rules. |
| Owns a Family or Business workspace with active members | Automatically delete the workspace with the owner's account. List the workspace in the confirmation and warn that all its members will lose access. Apply the adopted rules for any underlying records that must be retained. |
| Sole remaining member and owner of a Family or Business workspace | Automatically delete the workspace with the owner's account. Include it in the confirmation. Apply the adopted rules for any underlying records that must be retained. |
| Member of a Family or Business workspace owned by someone else | Remove membership and access. Keep the member’s payments and their existing name on those payments, including when the member deletes their Mushavo Budget account. Keep attached payment proofs available through the workspace’s existing access rules. |
| Holds a Mushavo Budget staff role | Review role removal, active access and any independent audit retention obligations before executing account deletion. |

The workspace-payment and name rules were confirmed on 16 November 2026. Payment amounts, dates, accounting relationships and the person’s existing display name stay on the retained payment in the surviving workspace. Account erasure must preserve that name without substituting an email address. On 16 November 2026 the owner confirmed that attached proofs stay with retained payments and remain available to authorized members of the surviving workspace.

## Data outcomes for approval

| Register category | Proposed handling | Fact to record before adoption |
| --- | --- | --- |
| Identity | Remove the login, profile and account-linked access after resolving dependent records and inventorying files. | Identity verification method for people who cannot sign in and the operator responsible for it. |
| Personal | Erase exclusively personal app records. Review invoices, subscription payments, refunds and disputes separately from the user's budget. | Required billing or dispute record types, retention trigger and term, and staff allowed to read them. |
| Shared finance | Erase requester-specific data without an independent purpose. For necessary workspace history, remove avoidable identifying fields and restrict retained records to authorized workspace roles. | Which records and identity fields must remain identifiable, the reason and duration, and who decides exceptions. |
| Invitations and support | Revoke open invitations and erase unneeded copies of the user's email and contact history. Limit any approved dispute or support retention to the case records it requires. | Retention purpose, expiry and access for unresolved cases, fraud or dispute evidence. |
| Telemetry and devices | Disable push subscriptions and delete account-linked device data. Keep only telemetry that meets the adopted retention rule and can be aggregated without identifying the person. | Treatment and expiry of any identifiable security logs. |
| Storage | Use the authoritative object inventory to delete personal files and verify removal. Apply the shared-record rule to necessary workspace attachments and any related identifying metadata. | How to treat specific shared receipt, document and proof types, including copies held outside Supabase. |
| Processors and backups | Remove active provider data where supported. Record provider-controlled expiry for residual data and verify that recovery procedures reapply erasure so restored records do not silently reappear. | Active processor list, configured backup retention and restoration procedure. |
| Completion record | Retain a minimal restricted receipt for the adopted verification period and communicate the actual outcome and retained categories. | Receipt contents, allowed readers, expiry and monitored contact. |

## Facts that determine the retention schedule

- Confirm the operator's legal name, launch countries and monitored privacy contact. Identify the relevant obligations and distinguish Mushavo Budget billing records from customer-managed bookkeeping records.
- Record the applicable retention purpose and expiry trigger for each exception. Verify the configured deletion and backup behavior for the services in use before setting notice or completion language.
- Confirm the outstanding retention rules for records in deleted workspaces. The approved ownership rule applies to both active and inactive owned workspaces.

Apple requires apps that support account creation to let people initiate deletion in the app. Google Play also calls for an external web resource and asks for retention practices to be disclosed. [Apple App Review](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) · [Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)

If Zimbabwe law applies to the operator, section 13 of the Cyber and Data Protection Act addresses limiting identifiable data to the period necessary for its purpose. Check jurisdiction and record-specific obligations before choosing periods. [Zimbabwe Ministry of ICT](https://ictministry.gov.zw/assets/documents/Cyber-and-Data-Protection-Act-Chapter-1207.pdf)

Supabase requires resolving Storage object ownership before Auth user deletion. Previously issued JWTs can still be cryptographically valid until expiry, so the staging acceptance must verify actual application and object denial after access removal. [Supabase Auth user management](https://supabase.com/docs/guides/auth/managing-user-data)
