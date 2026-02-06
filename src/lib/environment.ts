/**
 * Environment Detection Utilities
 * 
 * Provides utilities for detecting the current environment (staging vs production)
 * and enabling environment-specific behaviors.
 */

export type Environment = 'production' | 'staging' | 'development';

/**
 * Detect the current environment based on URL and build flags
 */
export function getEnvironment(): Environment {
  // Check for explicit environment variable
  const envFlag = import.meta.env.VITE_ENVIRONMENT;
  if (envFlag === 'production' || envFlag === 'staging' || envFlag === 'development') {
    return envFlag;
  }

  // Auto-detect based on URL
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'development';
    }
    
    // Preview/staging URLs (Lovable preview pattern)
    if (hostname.includes('-preview--') && hostname.endsWith('.lovable.app')) {
      return 'staging';
    }
    
    // Production: custom domains (pillaxia.app) or published Lovable URL
    // Any non-preview, non-localhost URL is considered production
    return 'production';
  }

  // Default to production for SSR/build contexts
  return 'production';
}

/**
 * Check if running in staging environment
 */
export function isStaging(): boolean {
  return getEnvironment() === 'staging';
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

/**
 * Check if E2E test mode is enabled
 * This is set via VITE_E2E_TEST=true when running Playwright tests
 */
export function isE2ETestMode(): boolean {
  return import.meta.env.VITE_E2E_TEST === 'true';
}

/**
 * Check if demo data mode is enabled (banner and demo accounts).
 * Also true when deployed to Azure Static Web Apps (*.azurestaticapps.net)
 * so the demo banner shows without requiring build-time env.
 */
export function isDemoMode(): boolean {
  if (
    import.meta.env.VITE_DEMO_MODE === 'true' ||
    import.meta.env.VITE_ENABLE_DEMO === 'true'
  ) {
    return true;
  }
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.azurestaticapps.net')) {
    return true;
  }
  return false;
}

/**
 * Check if the given email is a known demo account (e.g. *@pillaxia-dev.com)
 */
export function isDemoAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.endsWith('@pillaxia-dev.com') || email.endsWith('@demo.pillaxia.com');
}

/**
 * Get environment display name for UI banners
 */
export function getEnvironmentLabel(): string {
  const env = getEnvironment();
  switch (env) {
    case 'production':
      return 'Production';
    case 'staging':
      return 'Staging';
    case 'development':
      return 'Development';
    default:
      return 'Unknown';
  }
}
