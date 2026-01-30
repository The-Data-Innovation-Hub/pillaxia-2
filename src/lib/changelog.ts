/**
 * Changelog Data
 * 
 * Add new entries at the top of the array.
 * Each entry should include version, date, and changes.
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: {
    type: "feature" | "improvement" | "fix" | "security";
    description: string;
  }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.26",
    date: "2026-01-30",
    title: "Production Readiness - Phase 1",
    changes: [
      {
        type: "improvement",
        description: "Strict TypeScript typing for authentication context and hooks",
      },
      {
        type: "fix",
        description: "Fixed ESLint errors - converted require() to ESM imports",
      },
      {
        type: "improvement",
        description: "Updated ESLint config to exclude native platform directories",
      },
    ],
  },
  {
    version: "1.25",
    date: "2026-01-30",
    title: "Environment Detection Fix",
    changes: [
      {
        type: "fix",
        description: "Fixed staging banner incorrectly showing on custom production domains",
      },
      {
        type: "improvement",
        description: "Improved environment detection logic for custom domains",
      },
    ],
  },
  {
    version: "1.24",
    date: "2026-01-30",
    title: "Code Quality Improvements",
    changes: [
      {
        type: "improvement",
        description: "Added ESLint configuration with TypeScript and React hooks rules",
      },
      {
        type: "improvement",
        description: "Enabled unused variable warnings with smart exceptions",
      },
      {
        type: "improvement",
        description: "Added console.log warnings for production code",
      },
    ],
  },
  {
    version: "1.23",
    date: "2026-01-30",
    title: "Testing Infrastructure",
    changes: [
      {
        type: "feature",
        description: "Added Vitest configuration for frontend unit testing",
      },
      {
        type: "feature",
        description: "Added Playwright configuration for E2E testing",
      },
      {
        type: "improvement",
        description: "Test utilities with React Testing Library integration",
      },
    ],
  },
  {
    version: "1.22",
    date: "2026-01-30",
    title: "Sentry Error Tracking",
    changes: [
      {
        type: "feature",
        description: "Dynamic Sentry DSN fetching from edge function",
      },
      {
        type: "security",
        description: "Removed hardcoded Sentry DSN from client code",
      },
      {
        type: "improvement",
        description: "Lazy initialization of Sentry on first error",
      },
    ],
  },
  {
    version: "1.21",
    date: "2026-01-30",
    title: "Email Tracking & Analytics",
    changes: [
      {
        type: "feature",
        description: "Email open tracking via invisible pixel",
      },
      {
        type: "feature",
        description: "Email click tracking with secure redirect",
      },
      {
        type: "security",
        description: "URL validation for click tracking redirects",
      },
    ],
  },
  {
    version: "1.20",
    date: "2026-01-30",
    title: "Photo Medication Import",
    changes: [
      {
        type: "feature",
        description: "AI-powered prescription image analysis",
      },
      {
        type: "feature",
        description: "OCR extraction of medication details from photos",
      },
      {
        type: "improvement",
        description: "Confidence scoring for extracted medication data",
      },
    ],
  },
  {
    version: "1.19",
    date: "2026-01-30",
    title: "VAPID Push Notifications",
    changes: [
      {
        type: "feature",
        description: "VAPID public key edge function for web push",
      },
      {
        type: "security",
        description: "Server-side VAPID key management",
      },
      {
        type: "improvement",
        description: "Dynamic push notification configuration",
      },
    ],
  },
  {
    version: "1.18",
    date: "2026-01-30",
    title: "Capacitor Mobile Support",
    changes: [
      {
        type: "feature",
        description: "Native iOS and Android app support via Capacitor",
      },
      {
        type: "feature",
        description: "Native push notifications for mobile",
      },
      {
        type: "feature",
        description: "Haptic feedback integration",
      },
    ],
  },
  {
    version: "1.17",
    date: "2026-01-30",
    title: "Biometric Authentication",
    changes: [
      {
        type: "feature",
        description: "Face ID and Touch ID support for native apps",
      },
      {
        type: "security",
        description: "Secure credential storage with biometric protection",
      },
      {
        type: "improvement",
        description: "Biometric settings management in patient dashboard",
      },
    ],
  },
  {
    version: "1.16",
    date: "2026-01-30",
    title: "Session Management",
    changes: [
      {
        type: "security",
        description: "Session timeout warning with automatic logout",
      },
      {
        type: "feature",
        description: "Trusted device management",
      },
      {
        type: "improvement",
        description: "Session validation edge function",
      },
    ],
  },
  {
    version: "1.15",
    date: "2026-01-30",
    title: "Password Security",
    changes: [
      {
        type: "security",
        description: "Password breach checking via Have I Been Pwned API",
      },
      {
        type: "security",
        description: "k-Anonymity implementation for secure password checking",
      },
      {
        type: "improvement",
        description: "Password breach warnings during login and signup",
      },
    ],
  },
  {
    version: "1.14",
    date: "2026-01-30",
    title: "A/B Testing Framework",
    changes: [
      {
        type: "feature",
        description: "Email A/B testing for subject lines and content",
      },
      {
        type: "feature",
        description: "Admin dashboard for A/B test management",
      },
      {
        type: "improvement",
        description: "Statistical analysis for test results",
      },
    ],
  },
  {
    version: "1.13",
    date: "2026-01-30",
    title: "Notification Analytics",
    changes: [
      {
        type: "feature",
        description: "Comprehensive notification delivery analytics",
      },
      {
        type: "feature",
        description: "Channel engagement tracking and reporting",
      },
      {
        type: "improvement",
        description: "Engagement funnel visualization",
      },
    ],
  },
  {
    version: "1.12",
    date: "2026-01-30",
    title: "Compliance Reporting",
    changes: [
      {
        type: "feature",
        description: "HIPAA compliance report generation",
      },
      {
        type: "feature",
        description: "Audit log export functionality",
      },
      {
        type: "improvement",
        description: "Data access logging for compliance tracking",
      },
    ],
  },
  {
    version: "1.11",
    date: "2026-01-30",
    title: "Engagement Scores Authorization",
    changes: [
      {
        type: "security",
        description: "Added authorization checks to engagement score calculation",
      },
      {
        type: "security",
        description: "Batch engagement score processing restricted to admin users",
      },
      {
        type: "improvement",
        description: "Clinicians can only calculate scores for assigned patients",
      },
    ],
  },
  {
    version: "1.10",
    date: "2026-01-30",
    title: "Server-Verified Authorization",
    changes: [
      {
        type: "security",
        description: "Server-side role verification for dashboard routing - prevents client-side role manipulation",
      },
      {
        type: "security",
        description: "Added authorization checks to SECURITY DEFINER functions (trust_device, log_security_event, log_data_access)",
      },
      {
        type: "improvement",
        description: "New useServerVerifiedRoles hook for secure role fetching from backend",
      },
    ],
  },
  {
    version: "1.2",
    date: "2026-01-30",
    title: "Production Hardening & Security Fixes",
    changes: [
      {
        type: "security",
        description: "Fixed pharmacy locations data exposure - now requires authentication",
      },
      {
        type: "improvement",
        description: "TypeScript strict mode enabled for enhanced type safety",
      },
      {
        type: "improvement",
        description: "Vite build optimizations with vendor chunking for better caching",
      },
      {
        type: "feature",
        description: "Automatic version bumping on GitHub pushes",
      },
    ],
  },
  {
    version: "1.1",
    date: "2026-01-29",
    title: "Code Review Remediation Complete",
    changes: [
      {
        type: "security",
        description: "100% Sentry coverage across all 47 edge functions",
      },
      {
        type: "security",
        description: "Mandatory webhook signature verification for Stripe, Twilio, and Resend",
      },
      {
        type: "improvement",
        description: "Tiered rate limiting infrastructure for all edge functions",
      },
      {
        type: "improvement",
        description: "40+ strategic database indexes for query optimization",
      },
    ],
  },
  {
    version: "1.0",
    date: "2026-01-28",
    title: "Automatic Versioning & Changelog",
    changes: [
      {
        type: "feature",
        description: "Added automatic build versioning with unique build numbers",
      },
      {
        type: "feature",
        description: "Version badge now displayed across all platform layouts",
      },
      {
        type: "feature",
        description: "Changelog dialog to view release history",
      },
      {
        type: "improvement",
        description: "Build numbers auto-increment on each publish",
      },
    ],
  },
  {
    version: "0.9",
    date: "2026-01-27",
    title: "Security & Performance Enhancements",
    changes: [
      {
        type: "security",
        description: "Enterprise-grade HIPAA-compliant security controls",
      },
      {
        type: "security",
        description: "Enhanced RLS policies for all database tables",
      },
      {
        type: "improvement",
        description: "Optimized lazy loading for all routes",
      },
      {
        type: "fix",
        description: "Resolved offline sync conflict detection issues",
      },
    ],
  },
  {
    version: "0.8",
    date: "2026-01-25",
    title: "Multi-language Support",
    changes: [
      {
        type: "feature",
        description: "Added Hausa (ha) language support",
      },
      {
        type: "feature",
        description: "Added Yoruba (yo) language support",
      },
      {
        type: "feature",
        description: "Added Igbo (ig) language support",
      },
      {
        type: "improvement",
        description: "Language switcher in settings and navigation",
      },
    ],
  },
  {
    version: "0.7",
    date: "2026-01-20",
    title: "Caregiver Hub & Notifications",
    changes: [
      {
        type: "feature",
        description: "Caregiver invitation and management system",
      },
      {
        type: "feature",
        description: "Real-time notification center",
      },
      {
        type: "feature",
        description: "Multi-channel notification delivery (email, push, SMS, WhatsApp)",
      },
      {
        type: "improvement",
        description: "Encouragement messaging between caregivers and patients",
      },
    ],
  },
  {
    version: "0.6",
    date: "2026-01-15",
    title: "Angela AI Health Companion",
    changes: [
      {
        type: "feature",
        description: "Introduced Angela, the AI-powered health companion",
      },
      {
        type: "feature",
        description: "Natural language medication queries",
      },
      {
        type: "feature",
        description: "Personalized health insights and recommendations",
      },
    ],
  },
  {
    version: "0.5",
    date: "2026-01-10",
    title: "Offline Support & Sync",
    changes: [
      {
        type: "feature",
        description: "Full offline medication tracking",
      },
      {
        type: "feature",
        description: "Intelligent conflict resolution for sync",
      },
      {
        type: "feature",
        description: "Auto-resolution settings for simple conflicts",
      },
      {
        type: "improvement",
        description: "Offline symptom logging with queue management",
      },
    ],
  },
];

/**
 * Get the latest changelog entry
 */
export function getLatestChangelog(): ChangelogEntry | undefined {
  return CHANGELOG[0];
}

/**
 * Get changelog entries for a specific version
 */
export function getChangelogByVersion(version: string): ChangelogEntry | undefined {
  return CHANGELOG.find(entry => entry.version === version);
}
