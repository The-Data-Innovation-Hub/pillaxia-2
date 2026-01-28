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
