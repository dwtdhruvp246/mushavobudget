# Document archive scope correction

The selected staging PostgreSQL rehearsal demonstrated a scoped Finance Manager could archive an Owner's draft claim receipt outside the manager's assigned team. The same actor had documents.manage but could not view the parent claim or document through RLS. The Owner positive control passed. The transaction rolled back and independent readback confirmed no new documents, claims, dimensions or modeled sessions, and the original suspended workspace/seat state was preserved.

The archive RPC now checks the parent claim or bill visibility after locating and locking the document. This matches the private read and physical-delete scope boundaries. Its application-session, document-management, workspace, submitted-receipt lock, audit and return behavior remain intact. The existing anonymous denial and authenticated/service grants are preserved.

The local PostgreSQL checks cover foreign claim/bill/payment parent denial without mutation or audit, permitted archive, submitted receipt lock, editable changes-requested receipt, management/session/workspace denial and replay. Hosted recheck and exact cleanup are recorded separately. All Auth claims in the selected hosted transaction are modeled; this is not an HTTP sign-in/upload test.
