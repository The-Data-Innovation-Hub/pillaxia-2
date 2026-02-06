/**
 * Validates required environment variables at application startup.
 * Throws an error if critical variables are missing, preventing
 * the app from running in a broken state.
 */

const REQUIRED_VARS = ['VITE_API_URL'] as const;

export function validateEnvironment(): void {
  const missing: string[] = [];

  for (const v of REQUIRED_VARS) {
    if (!import.meta.env[v]?.trim()) missing.push(v);
  }

  // Require at least one client ID variable
  const hasClientId =
    import.meta.env.VITE_AZURE_CLIENT_ID ||
    import.meta.env.VITE_ENTRA_CLIENT_ID;
  if (!hasClientId) {
    missing.push('VITE_AZURE_CLIENT_ID or VITE_ENTRA_CLIENT_ID');
  }

  // Require at least one authority variable
  const hasAuthority =
    import.meta.env.VITE_AZURE_AUTHORITY ||
    import.meta.env.VITE_ENTRA_EXTERNAL_ID_AUTHORITY ||
    import.meta.env.VITE_AZURE_B2C_AUTHORITY ||
    import.meta.env.VITE_AZURE_B2C_TENANT;
  if (!hasAuthority) {
    missing.push('VITE_AZURE_AUTHORITY (or VITE_ENTRA_EXTERNAL_ID_AUTHORITY)');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Please check your .env file — see .env.example for reference.'
    );
  }
}
