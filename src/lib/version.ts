/**
 * Application Version Configuration
 * 
 * This file manages the application version for display across the platform.
 * Version follows semantic versioning: MAJOR.MINOR.PATCH
 * 
 * Update this file when releasing new versions:
 * - MAJOR: Breaking changes or major feature releases
 * - MINOR: New features, backwards compatible
 * - PATCH: Bug fixes, minor improvements
 */

export const APP_VERSION = "1.0.0";

export const VERSION_INFO = {
  version: APP_VERSION,
  buildDate: new Date().toISOString().split('T')[0],
  environment: import.meta.env.MODE || 'development',
};

/**
 * Get formatted version string for display
 */
export function getVersionDisplay(): string {
  return `v${APP_VERSION}`;
}

/**
 * Get full version info for debugging/support
 */
export function getFullVersionInfo(): string {
  return `v${APP_VERSION} (${VERSION_INFO.environment})`;
}
