/**
 * Application Version Configuration
 * 
 * This file manages the application version for display across the platform.
 * 
 * Version Structure:
 * - MAJOR.MINOR: Manually set for significant releases
 * - Build Number: Auto-generated from build timestamp (YYYYMMDD.HHMM)
 * 
 * The build number automatically increments with each publish/build,
 * providing unique version identifiers without manual intervention.
 */

// Declare build-time constants injected by Vite
declare const __BUILD_TIMESTAMP__: string;
declare const __BUILD_DATE__: string;
declare const __BUILD_NUMBER__: string;

// Base version - update manually for major/minor releases
const MAJOR_VERSION = 1;
const MINOR_VERSION = 6;

// Build-time values (injected by Vite at build time)
const buildTimestamp = typeof __BUILD_TIMESTAMP__ !== 'undefined' 
  ? __BUILD_TIMESTAMP__ 
  : new Date().toISOString();

const buildDate = typeof __BUILD_DATE__ !== 'undefined' 
  ? __BUILD_DATE__ 
  : new Date().toISOString().split('T')[0];

const buildNumber = typeof __BUILD_NUMBER__ !== 'undefined' 
  ? __BUILD_NUMBER__ 
  : 'dev';

// Full semantic version with build number
export const APP_VERSION = `${MAJOR_VERSION}.${MINOR_VERSION}.${buildNumber}`;

// Short version for compact display
export const APP_VERSION_SHORT = `${MAJOR_VERSION}.${MINOR_VERSION}`;

export const VERSION_INFO = {
  major: MAJOR_VERSION,
  minor: MINOR_VERSION,
  buildNumber,
  version: APP_VERSION,
  shortVersion: APP_VERSION_SHORT,
  buildDate,
  buildTimestamp,
  environment: import.meta.env.MODE || 'development',
  isProduction: import.meta.env.PROD,
};

/**
 * Get formatted version string for display (short format)
 */
export function getVersionDisplay(): string {
  return `v${APP_VERSION_SHORT}`;
}

/**
 * Get full version with build number
 */
export function getFullVersion(): string {
  return `v${APP_VERSION}`;
}

/**
 * Get full version info for debugging/support
 */
export function getFullVersionInfo(): string {
  return `v${APP_VERSION} (${VERSION_INFO.environment})`;
}

/**
 * Get build identifier for support tickets
 */
export function getBuildIdentifier(): string {
  return `${APP_VERSION}-${VERSION_INFO.environment}`;
}
