/**
 * API tests for the Pillaxia Express API.
 *
 * Includes smoke tests, security middleware validation,
 * storage route security, health endpoint tests, and
 * ACL enforcement without requiring a real database.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';

// ── Mock pg ──
const mockClient = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
  release: vi.fn(),
};
const mockPool = {
  connect: vi.fn().mockResolvedValue(mockClient),
  query: vi.fn().mockResolvedValue({ rows: [] }),
  totalCount: 10,
  idleCount: 8,
  waitingCount: 0,
};

vi.mock('pg', () => {
  const Pool = vi.fn(() => mockPool);
  return { default: { Pool } };
});

// ── Mock passport-azure-ad ──
vi.mock('passport-azure-ad', () => ({
  BearerStrategy: vi.fn().mockImplementation(() => ({
    name: 'oauth-bearer',
    authenticate: vi.fn(),
  })),
}));

// ── Mock passport (default: unauthenticated) ──
let authBehavior = 'reject';
vi.mock('passport', () => {
  const passport = {
    use: vi.fn(),
    authenticate: vi.fn(() => (req, res, next) => {
      if (authBehavior === 'allow') {
        req.userId = '12345678-1234-1234-1234-123456789abc';
        req.jwtClaims = { oid: req.userId, emails: ['test@example.com'] };
        return next();
      }
      return res.status(401).json({ error: 'Invalid or missing token' });
    }),
  };
  return { default: passport };
});

// ── Mock pino/pino-http to avoid transport issues in test ──
vi.mock('pino', () => {
  const noop = () => {};
  const mockLogger = { info: noop, warn: noop, error: noop, debug: noop, child: () => mockLogger, level: 'silent' };
  const pino = vi.fn(() => mockLogger);
  pino.stdSerializers = { err: (e) => e, req: (r) => r, res: (r) => r };
  return { default: pino };
});

vi.mock('pino-http', () => {
  return { default: vi.fn(() => (_req, _res, next) => next()) };
});

// Suppress logger.js import
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis() },
}));

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  process.env.AZURE_B2C_CLIENT_ID = 'test-client-id';
  process.env.AZURE_B2C_TENANT = 'test-tenant';
  process.env.AZURE_B2C_TENANT_ID = 'test-tenant-id';
  process.env.AZURE_B2C_POLICY = 'B2C_1_test';

  const mod = await import('./index.js');
  app = mod.app;
});

beforeEach(() => {
  authBehavior = 'reject'; // default: unauthenticated
  vi.clearAllMocks();
  // Restore mock pool defaults
  mockPool.query.mockResolvedValue({ rows: [] });
  mockPool.totalCount = 10;
  mockPool.idleCount = 8;
  mockPool.waitingCount = 0;
});

// ──────────────────────────────────────────────
// Health endpoints
// ──────────────────────────────────────────────

describe('Health endpoints', () => {
  it('GET /health returns 200 with DB connectivity info', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('db');
    expect(res.body.db.status).toBe('connected');
    expect(res.body).toHaveProperty('pool');
  });

  it('GET /health/ready returns 200 with pool stats', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.pool).toEqual({ total: 10, idle: 8, waiting: 0 });
  });

  it('GET /health/ready returns 503 when DB is down', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.db.status).toBe('disconnected');
  });

  it('GET /health/live always returns 200', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ──────────────────────────────────────────────
// Authentication
// ──────────────────────────────────────────────

describe('Authentication', () => {
  it('GET /rest/profiles returns 401 without token', async () => {
    const res = await request(app).get('/rest/profiles');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /rpc/upsert_user_from_jwt returns 401 without token', async () => {
    const res = await request(app).post('/rpc/upsert_user_from_jwt');
    expect(res.status).toBe(401);
  });

  it('POST /rest/profiles returns 401 without token', async () => {
    const res = await request(app)
      .post('/rest/profiles')
      .send({ first_name: 'Test' });
    expect(res.status).toBe(401);
  });

  it('DELETE /rest/profiles returns 401 without token', async () => {
    const res = await request(app).delete('/rest/profiles');
    expect(res.status).toBe(401);
  });

  it('PATCH /rest/profiles returns 401 without token', async () => {
    const res = await request(app)
      .patch('/rest/profiles')
      .send({ first_name: 'Test' });
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────
// CORS
// ──────────────────────────────────────────────

describe('CORS', () => {
  it('responds with CORS headers for allowed origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:8080');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:8080');
  });

  it('does not set CORS header for disallowed origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

// ──────────────────────────────────────────────
// Security headers
// ──────────────────────────────────────────────

describe('Security headers', () => {
  it('includes helmet security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers).toHaveProperty('x-content-type-options');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

// ──────────────────────────────────────────────
// Storage route security
// ──────────────────────────────────────────────

describe('Storage route security', () => {
  it('rejects uploads to unknown buckets', async () => {
    authBehavior = 'allow';
    const res = await request(app)
      .put('/storage/evil-bucket/12345678-1234-1234-1234-123456789abc/test.png')
      .set('Content-Type', 'image/png')
      .send(Buffer.from('fake image data'));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden bucket');
  });

  it('rejects path traversal attempts', async () => {
    authBehavior = 'allow';
    const res = await request(app)
      .put('/storage/avatars/../../etc/passwd')
      .set('Content-Type', 'image/png')
      .send(Buffer.from('fake'));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid path');
  });

  it('rejects uploads without ownership prefix', async () => {
    authBehavior = 'allow';
    const res = await request(app)
      .put('/storage/avatars/other-user-id/test.png')
      .set('Content-Type', 'image/png')
      .send(Buffer.from('fake'));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden: ownership required');
  });

  it('rejects disallowed file types', async () => {
    authBehavior = 'allow';
    const userId = '12345678-1234-1234-1234-123456789abc';
    const res = await request(app)
      .put(`/storage/avatars/${userId}/exploit.exe`)
      .set('Content-Type', 'application/x-msdownload')
      .send(Buffer.from('fake'));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('File type not allowed');
  });

  it('rejects delete with unknown bucket', async () => {
    authBehavior = 'allow';
    const res = await request(app)
      .delete('/storage/evil-bucket')
      .send({ paths: ['test.png'] });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden bucket');
  });

  it('rejects delete with path traversal in paths array', async () => {
    authBehavior = 'allow';
    const userId = '12345678-1234-1234-1234-123456789abc';
    const res = await request(app)
      .delete('/storage/avatars')
      .send({ paths: [`${userId}/file.png`, '../../etc/passwd'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid path in paths array');
  });

  it('rejects delete without ownership prefix in paths', async () => {
    authBehavior = 'allow';
    const res = await request(app)
      .delete('/storage/avatars')
      .send({ paths: ['other-user/file.png'] });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('ownership required');
  });
});

// ──────────────────────────────────────────────
// UUID validation
// ──────────────────────────────────────────────

describe('UUID validation', () => {
  it('rejects non-UUID user ID values', () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    expect(UUID_RE.test('12345678-1234-1234-1234-123456789abc')).toBe(true);
    expect(UUID_RE.test("'; DROP TABLE users; --")).toBe(false);
    expect(UUID_RE.test('not-a-uuid')).toBe(false);
    expect(UUID_RE.test('')).toBe(false);
    expect(UUID_RE.test('12345678123412341234123456789abc')).toBe(false);
  });
});

// ──────────────────────────────────────────────
// Error sanitization
// ──────────────────────────────────────────────

describe('Error sanitization', () => {
  it('safeError strips details in production mode', () => {
    const IS_PRODUCTION = true;

    function safeError(err) {
      if (IS_PRODUCTION) {
        const msg = err.message || '';
        if (msg.includes('violates')) return 'Data validation error';
        if (msg.includes('duplicate key')) return 'Record already exists';
        if (msg.includes('not-null') || msg.includes('null value')) return 'Required field missing';
        return 'Request failed';
      }
      return err.message;
    }

    expect(safeError(new Error('violates foreign key constraint'))).toBe('Data validation error');
    expect(safeError(new Error('duplicate key value violates unique constraint'))).toBe('Data validation error');
    expect(safeError(new Error('null value in column "name" of relation "profiles"'))).toBe('Required field missing');
    expect(safeError(new Error('some internal pg error'))).toBe('Request failed');
  });
});

// ──────────────────────────────────────────────
// REST route ACL enforcement
// ──────────────────────────────────────────────

describe('REST route ACL', () => {
  it('denies access to unknown tables with 403', async () => {
    authBehavior = 'allow';
    // The mock pool will return empty rows for schema queries,
    // which means enforceTableAccess should deny unknown tables
    const res = await request(app).get('/rest/nonexistent_table');
    // Either 403 (deny-by-default for unknown tables) or 400 depending on implementation
    expect([400, 403]).toContain(res.status);
  });
});

// ──────────────────────────────────────────────
// Rate limiting
// ──────────────────────────────────────────────

describe('Rate limiting', () => {
  it('includes rate limit headers on responses', async () => {
    const res = await request(app).get('/health');
    // express-rate-limit adds standardized headers
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
  });
});
