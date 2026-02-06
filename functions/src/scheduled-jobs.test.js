/**
 * Scheduled Jobs smoke tests for the Pillaxia Azure Functions.
 *
 * These tests verify that shared handlers use correct SQL queries,
 * timer functions are properly configured, and HTTP triggers include CORS headers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database module
const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
vi.mock('../shared/db.js', () => ({
  query: (...args) => mockQuery(...args),
}));

// Mock Sentry
vi.mock('../shared/sentry.js', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  processBatch: vi.fn(),
}));

// Mock email
vi.mock('../shared/email/sendEmail.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../shared/email/escapeHtml.js', () => ({
  escapeHtml: (str) => str,
}));

// Mock medication helpers
vi.mock('../shared/medications/upcomingDoses.js', () => ({
  fetchUpcomingDoses: vi.fn().mockResolvedValue([]),
  groupDosesByUser: vi.fn().mockReturnValue({}),
  getMedicationNames: vi.fn().mockReturnValue([]),
}));

vi.mock('../shared/email/templates/medicationReminder.js', () => ({
  generateMedicationReminderHtml: vi.fn().mockReturnValue('<html></html>'),
  generateMedicationReminderSubject: vi.fn().mockReturnValue('Reminder'),
}));

vi.mock('../shared/notifications/userPreferences.js', () => ({
  fetchUserPreferences: vi.fn().mockResolvedValue({}),
  getDefaultPreferences: vi.fn().mockReturnValue({ email_enabled: false, push_enabled: false }),
}));

vi.mock('../shared/notifications/quietHours.js', () => ({
  isInQuietHours: vi.fn().mockReturnValue(false),
}));

vi.mock('../shared/auth.js', () => ({
  getUserFromRequest: vi.fn().mockReturnValue({ oid: 'test-user-id' }),
  unauthorizedResponse: vi.fn().mockReturnValue({ status: 401, jsonBody: { error: 'Unauthorized' } }),
}));

// Capture all registered functions
const registeredTimers = {};
const registeredHttp = {};

vi.mock('@azure/functions', () => ({
  app: {
    timer: (name, config) => {
      registeredTimers[name] = config;
    },
    http: (name, config) => {
      registeredHttp[name] = config;
    },
  },
}));

// Import the module to trigger all registrations
beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
});

// Need to import after mocks are set up
await import('./scheduled-jobs.js');

describe('Timer function registration', () => {
  it('registers send-medication-reminders-timer', () => {
    expect(registeredTimers).toHaveProperty('send-medication-reminders-timer');
    expect(registeredTimers['send-medication-reminders-timer'].schedule).toBe('0 */15 * * * *');
  });

  it('registers send-appointment-reminders-timer', () => {
    expect(registeredTimers).toHaveProperty('send-appointment-reminders-timer');
    expect(registeredTimers['send-appointment-reminders-timer'].schedule).toBe('0 0 * * * *');
  });

  it('registers check-missed-doses-timer', () => {
    expect(registeredTimers).toHaveProperty('check-missed-doses-timer');
    expect(registeredTimers['check-missed-doses-timer'].schedule).toBe('0 */30 * * * *');
  });

  it('registers calculate-engagement-scores-timer', () => {
    expect(registeredTimers).toHaveProperty('calculate-engagement-scores-timer');
    expect(registeredTimers['calculate-engagement-scores-timer'].schedule).toBe('0 0 2 * * *');
  });

  it('registers check-medication-expiry-timer', () => {
    expect(registeredTimers).toHaveProperty('check-medication-expiry-timer');
    expect(registeredTimers['check-medication-expiry-timer'].schedule).toBe('0 0 6 * * *');
  });

  it('registers refresh-materialized-views-timer', () => {
    expect(registeredTimers).toHaveProperty('refresh-materialized-views-timer');
    expect(registeredTimers['refresh-materialized-views-timer'].schedule).toBe('0 30 2 * * *');
  });

  it('registers cleanup-audit-logs-timer', () => {
    expect(registeredTimers).toHaveProperty('cleanup-audit-logs-timer');
    expect(registeredTimers['cleanup-audit-logs-timer'].schedule).toBe('0 0 4 * * *');
  });
});

describe('HTTP function registration', () => {
  it('registers check-medication-expiry HTTP trigger', () => {
    expect(registeredHttp).toHaveProperty('check-medication-expiry');
    expect(registeredHttp['check-medication-expiry'].methods).toContain('POST');
    expect(registeredHttp['check-medication-expiry'].methods).toContain('OPTIONS');
  });

  it('registers check-red-flag-symptoms HTTP trigger', () => {
    expect(registeredHttp).toHaveProperty('check-red-flag-symptoms');
    expect(registeredHttp['check-red-flag-symptoms'].methods).toContain('POST');
  });

  it('registers calculate-engagement-scores HTTP trigger', () => {
    expect(registeredHttp).toHaveProperty('calculate-engagement-scores');
    expect(registeredHttp['calculate-engagement-scores'].methods).toContain('POST');
  });
});

describe('Calculate engagement scores handler', () => {
  it('uses correct column names in INSERT query', async () => {
    // Mock user query to return one patient
    mockQuery
      .mockResolvedValueOnce({ rows: [{ user_id: 'test-user' }] }) // users query
      .mockResolvedValueOnce({ rows: [{ taken: '5', missed: '1' }] }) // adherence
      .mockResolvedValueOnce({ rows: [{ cnt: '3' }] }) // checkins
      .mockResolvedValueOnce({ rows: [] }); // INSERT

    const handler = registeredTimers['calculate-engagement-scores-timer'].handler;
    const context = {
      log: vi.fn(),
      error: vi.fn(),
    };

    await handler({}, context);

    // Find the INSERT call
    const insertCall = mockQuery.mock.calls.find((c) =>
      c[0]?.includes('INSERT INTO patient_engagement_scores')
    );

    expect(insertCall).toBeDefined();
    // Verify it uses the correct column names
    expect(insertCall[0]).toContain('overall_score');
    expect(insertCall[0]).toContain('adherence_score');
    expect(insertCall[0]).toContain('app_usage_score');
    expect(insertCall[0]).toContain('score_date');
  });
});

describe('Refresh materialized views handler', () => {
  it('refreshes all 6 materialized views', async () => {
    const handler = registeredTimers['refresh-materialized-views-timer'].handler;
    const context = {
      log: vi.fn(),
      warn: vi.fn(),
    };

    await handler({}, context);

    const refreshCalls = mockQuery.mock.calls.filter((c) =>
      c[0]?.includes('REFRESH MATERIALIZED VIEW')
    );

    expect(refreshCalls.length).toBe(6);
    expect(refreshCalls.map((c) => c[0])).toEqual(
      expect.arrayContaining([
        expect.stringContaining('medication_availability_view'),
        expect.stringContaining('patient_vitals_with_bmi_view'),
        expect.stringContaining('medications_full_view'),
      ])
    );
  });

  it('continues on failure of individual view refresh', async () => {
    // Make the first view refresh fail
    mockQuery
      .mockRejectedValueOnce(new Error('relation does not exist'))
      .mockResolvedValue({ rows: [] });

    const handler = registeredTimers['refresh-materialized-views-timer'].handler;
    const context = {
      log: vi.fn(),
      warn: vi.fn(),
    };

    // Should not throw
    await handler({}, context);

    // Should have tried all 6 views
    expect(mockQuery).toHaveBeenCalledTimes(6);
    // Should have logged a warning for the failed view
    expect(context.warn).toHaveBeenCalled();
  });
});

describe('HTTP trigger CORS', () => {
  it('check-medication-expiry returns CORS headers on OPTIONS', async () => {
    const handler = registeredHttp['check-medication-expiry'].handler;
    const req = {
      method: 'OPTIONS',
      headers: {
        get: (name) => (name === 'Origin' ? 'http://localhost:8080' : null),
      },
    };

    process.env.CORS_ORIGIN = 'http://localhost:8080';
    const response = await handler(req);

    expect(response.status).toBe(204);
    expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
    expect(response.headers).toHaveProperty('Access-Control-Allow-Methods');
  });
});
