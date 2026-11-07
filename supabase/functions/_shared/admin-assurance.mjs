// Use only a user client bound to the getUser-validated bearer, never a service client.
// The RPC checks server roles/profile/factors and the same PostgREST JWT's assurance.
export async function requireAdminAssurance(userClient) {
  try {
    const {data,error}=await userClient.rpc('admin_mfa_status');
    if(error || data?.staff!==true || data?.active!==true || data?.authorized!==true || data?.has_verified_factor!==true) {
      throw new Error('ADMIN_MFA_REQUIRED');
    }
  } catch (_) {
    // Do not disclose SDK responses, factor identifiers, JWTs or internal errors.
    throw new Error('ADMIN_MFA_REQUIRED');
  }
}
