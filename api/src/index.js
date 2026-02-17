/**
 * Pillaxia API – Azure AD B2C JWT validation with direct PostgreSQL queries
 *
 * Security model (two-layer):
 *  Layer 1 – API middleware: validates JWT, extracts user_id, enforces
 *            table-level access control & ownership checks.
 *  Layer 2 – Database RLS: JWT claims are SET LOCAL per transaction so
 *            PostgreSQL RLS policies act as a safety net.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import crypto from 'crypto';
import { BearerStrategy } from 'passport-azure-ad';
import passport from 'passport';
import pg from 'pg';
import dotenv from 'dotenv';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from './logger.js';

dotenv.config();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const app = express();
const PORT = process.env.PORT || 3000;

// ──────────────────────────────────────────────
// PostgreSQL connection pool
// ──────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  max: parseInt(process.env.PG_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// ──────────────────────────────────────────────
// secureQuery – wraps every DB call in a transaction
// that sets request.jwt.claims so RLS policies fire.
// ──────────────────────────────────────────────
async function secureQuery(userId, text, params = []) {
  // Validate userId is a valid UUID to prevent injection in SET LOCAL
  if (userId && !UUID_RE.test(userId)) {
    throw new Error('Invalid user ID format');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Set statement timeout (10 s max per query)
    await client.query("SET LOCAL statement_timeout = '10s'");
    // Inject JWT claims so RLS can use auth.uid() / current_user_id()
    if (userId) {
      const claims = JSON.stringify({ oid: userId, sub: userId });
      // Use parameterized SET LOCAL to prevent SQL injection
      await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims]);
    }
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────
// Schema cache – whitelist tables & columns from information_schema
// ──────────────────────────────────────────────
let _schemaCache = null;
async function getSchemaMap() {
  if (_schemaCache) return _schemaCache;
  try {
    const { rows } = await pool.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
    );
    _schemaCache = {};
    for (const r of rows) {
      if (!_schemaCache[r.table_name]) _schemaCache[r.table_name] = new Set();
      _schemaCache[r.table_name].add(r.column_name);
    }
  } catch (e) {
    logger.error({ err: e }, 'Schema cache load failed');
    _schemaCache = {};
  }
  return _schemaCache;
}

/**
 * Validate that a table exists and columns belong to it.
 * Returns true if valid, false if not.
 */
async function validateTableColumns(table, columns) {
  const schema = await getSchemaMap();
  const tableSchema = schema[table];
  if (!tableSchema) return false;
  for (const col of columns) {
    if (col === '*') continue;
    if (!tableSchema.has(col)) return false;
  }
  return true;
}

// ──────────────────────────────────────────────
// Safe error helper – strips internal details in production
// ──────────────────────────────────────────────
function safeError(err) {
  if (IS_PRODUCTION) {
    const msg = err.message || '';
    if (msg.includes('violates')) return 'Data validation error';
    if (msg.includes('duplicate key')) return 'Record already exists';
    if (msg.includes('not-null') || msg.includes('null value')) return 'Required field missing';
    if (msg.includes('Invalid user ID')) return 'Invalid request';
    return 'Request failed';
  }
  return err.message;
}

// ──────────────────────────────────────────────
// Table access control matrix
// ──────────────────────────────────────────────
// ownership_col  – column that must equal req.userId for patient-owned data
// alt_cols       – alternative ownership columns (e.g. clinician_user_id)
// roles          – array of roles allowed to access the table (empty = all authenticated)
// readonly       – if true, only GET is allowed
// admin_only     – only admin role may access
// ──────────────────────────────────────────────
const TABLE_ACL = {
  // ── Patient-owned ─────────────────────────────
  profiles:                        { ownership_col: 'user_id' },
  medications:                     { ownership_col: 'user_id' },
  medication_schedules:            { ownership_col: null }, // ownership via medications FK
  medication_logs:                 { ownership_col: 'user_id' },
  symptom_entries:                 { ownership_col: 'user_id' },
  patient_vitals:                  { ownership_col: 'user_id' },
  lab_results:                     { ownership_col: 'user_id' },
  patient_chronic_conditions:      { ownership_col: 'user_id' },
  patient_allergies:               { ownership_col: 'user_id' },
  patient_emergency_contacts:      { ownership_col: 'user_id' },
  patient_notification_preferences:{ ownership_col: 'user_id' },
  patient_preferred_pharmacies:    { ownership_col: 'patient_user_id' },
  medication_availability_alerts:  { ownership_col: 'patient_user_id' },
  push_subscriptions:              { ownership_col: 'user_id' },
  notification_history:            { ownership_col: 'user_id', readonly: true },
  patient_activity_log:            { ownership_col: 'user_id' },
  patient_engagement_scores:       { ownership_col: 'user_id', readonly: true },
  security_notification_preferences: { ownership_col: 'user_id' },
  trusted_devices:                 { ownership_col: 'user_id' },

  // ── Cross-role (patient + clinician) ──────────
  clinician_patient_assignments:   { alt_cols: ['clinician_user_id', 'patient_user_id'] },
  clinician_messages:              { alt_cols: ['clinician_user_id', 'patient_user_id'] },
  caregiver_messages:              { alt_cols: ['caregiver_user_id', 'patient_user_id'] },
  caregiver_invitations:           { alt_cols: ['patient_user_id', 'caregiver_user_id'] },
  appointments:                    { alt_cols: ['clinician_user_id', 'patient_user_id'] },
  prescriptions:                   { alt_cols: ['clinician_user_id', 'patient_user_id'] },
  prescription_status_history:     { roles: ['clinician', 'pharmacist', 'admin'] },
  refill_requests:                 { alt_cols: ['patient_user_id'] },
  soap_notes:                      { roles: ['clinician', 'admin'] },
  red_flag_alerts:                 { roles: ['clinician', 'admin'] },
  polypharmacy_warnings:           { roles: ['clinician', 'admin'] },
  patient_risk_flags:              { roles: ['clinician', 'admin'] },

  // ── Clinician-scoped ──────────────────────────
  video_rooms:                     { alt_cols: ['clinician_user_id', 'patient_user_id'] },
  video_room_participants:         { roles: ['clinician', 'patient'] },
  video_call_notes:                { roles: ['clinician'] },

  // ── Pharmacist-scoped ─────────────────────────
  pharmacy_locations:              { ownership_col: 'pharmacist_user_id', roles: ['pharmacist', 'admin'] },
  medication_availability:         { roles: ['pharmacist', 'admin'] },
  controlled_drugs:                { roles: ['pharmacist', 'admin'] },
  controlled_drug_dispensing:      { roles: ['pharmacist', 'admin'] },
  controlled_drug_adjustments:     { roles: ['pharmacist', 'admin'] },
  drug_recalls:                    { roles: ['pharmacist', 'admin'] },
  drug_recall_notifications:       { roles: ['pharmacist', 'admin'] },
  drug_transfers:                  { roles: ['pharmacist', 'admin'] },

  // ── Reference / read-only for everyone ────────
  user_roles:                      { roles: ['admin', 'manager'] }, // admins/managers can assign roles in User Management
  medication_catalog:              { readonly: true },
  drug_interactions:               { readonly: true },
  notification_settings:           { readonly: true },

  // ── Organization ──────────────────────────────
  organizations:                   { roles: ['admin', 'manager'] },
  organization_members:            { roles: ['admin', 'manager'] },
  organization_branding:           { roles: ['admin', 'manager'] },
  organization_subscriptions:      { admin_only: true },
  organization_invoices:           { admin_only: true },
  organization_payment_methods:    { admin_only: true },
  billing_events:                  { admin_only: true },

  // ── Admin-only ────────────────────────────────
  security_settings:               { admin_only: true },
  security_events:                 { admin_only: true, readonly: true },
  audit_log:                       { admin_only: true, readonly: true },
  data_access_log:                 { admin_only: true, readonly: true },
  compliance_reports:              { admin_only: true },
  login_attempts:                  { admin_only: true, readonly: true },
  account_lockouts:                { admin_only: true },
  user_sessions:                   { admin_only: true },
  user_login_locations:            { admin_only: true, readonly: true },

  // ── A/B testing ───────────────────────────────
  email_ab_tests:                  { admin_only: true },
  email_ab_assignments:            { admin_only: true },
};

// Quick helper: fetch roles for a given userId (cached per-request on req object)
async function getUserRoles(userId, req) {
  if (req._cachedRoles) return req._cachedRoles;
  const result = await secureQuery(
    userId,
    'SELECT role FROM public.user_roles WHERE user_id = $1',
    [userId]
  );
  req._cachedRoles = result.rows.map((r) => r.role);
  return req._cachedRoles;
}

// ──────────────────────────────────────────────
// Azure AD B2C configuration
// ──────────────────────────────────────────────
const B2C_CONFIG = {
  identityMetadata:
    process.env.AZURE_B2C_METADATA ||
    `https://${process.env.AZURE_B2C_TENANT}.b2clogin.com/${process.env.AZURE_B2C_TENANT}.onmicrosoft.com/${process.env.AZURE_B2C_POLICY}/v2.0/.well-known/openid-configuration`,
  clientID: process.env.AZURE_B2C_CLIENT_ID,
  audience: process.env.AZURE_B2C_CLIENT_ID,
  issuer:
    process.env.AZURE_B2C_ISSUER ||
    `https://${process.env.AZURE_B2C_TENANT}.b2clogin.com/${process.env.AZURE_B2C_TENANT_ID}/v2.0/`,
  policyName: process.env.AZURE_B2C_POLICY || 'B2C_1_signin',
  passReqToCallback: false,
  validateIssuer: true,
  loggingLevel: 'error',
};

const bearerStrategy = new BearerStrategy(
  {
    identityMetadata: B2C_CONFIG.identityMetadata,
    clientID: B2C_CONFIG.clientID,
    audience: B2C_CONFIG.audience,
    issuer: B2C_CONFIG.issuer,
    validateIssuer: B2C_CONFIG.validateIssuer,
    passReqToCallback: B2C_CONFIG.passReqToCallback,
    loggingLevel: B2C_CONFIG.loggingLevel,
  },
  (token, done) => done(null, token, token)
);

passport.use(bearerStrategy);

// ──────────────────────────────────────────────
// Sync user from JWT claims to public.users
// ──────────────────────────────────────────────
async function syncUserFromJwt(claims) {
  const oid = claims.oid || claims.sub;
  if (!oid) return null;

  const email =
    claims.emails?.[0] || claims.email || claims.preferred_username;
  const rawUserMetaData = JSON.stringify({
    name: claims.name,
    given_name: claims.given_name,
    family_name: claims.family_name,
  });

  await secureQuery(null, 'SELECT public.upsert_user_from_jwt($1::uuid, $2, $3::jsonb)', [
    oid,
    email,
    rawUserMetaData,
  ]);
  return oid;
}

// ──────────────────────────────────────────────
// Middleware: validate B2C JWT, sync user, attach userId
// ──────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  // TEMPORARY: Bypass auth for debugging
  if (process.env.DISABLE_AUTH === 'true') {
    logger.warn('⚠️  Authentication bypassed - DISABLE_AUTH is enabled');
    // Using manager@demo.pillaxia.com from seed data (has manager role)
    req.userId = 'a1000000-0000-0000-0000-000000000001';
    req.user = { oid: req.userId };
    req.jwtClaims = { oid: req.userId };
    return next();
  }

  passport.authenticate(
    'oauth-bearer',
    { session: false },
    async (err, token) => {
      if (err) {
        logger.warn({ err }, 'Authentication failed');
        return res.status(401).json({ error: 'Authentication failed' });
      }
      if (!token) return res.status(401).json({ error: 'Invalid or missing token' });

      req.user = token;
      req.jwtClaims = token;
      req.userId = token.oid || token.sub;

      // Sync user to public.users
      try {
        await syncUserFromJwt(token);
      } catch (syncErr) {
        logger.error({ err: syncErr }, 'User sync error');
      }
      next();
    }
  )(req, res, next);
};

// ──────────────────────────────────────────────
// Access-control middleware for REST routes
// ──────────────────────────────────────────────
/**
 * Enforce table-level access control.
 * Returns null if access denied (response already sent).
 * Returns an object with optional ownershipFilter for query injection.
 */
async function enforceTableAccess(req, res, table, method) {
  const acl = TABLE_ACL[table];
  if (!acl) {
    // Deny unknown tables by default
    res.status(403).json({ error: 'Forbidden: unknown resource' });
    return null;
  }

  const userId = req.userId;
  const roles = await getUserRoles(userId, req);

  // Admin-only check
  if (acl.admin_only && !roles.includes('admin')) {
    res.status(403).json({ error: 'Forbidden: admin role required' });
    return null;
  }

  // Role check
  if (acl.roles && acl.roles.length > 0) {
    const hasRole = acl.roles.some((r) => roles.includes(r));
    // Patients can access their own data in cross-role tables via RLS
    if (!hasRole && !acl.ownership_col && !acl.alt_cols) {
      res.status(403).json({ error: 'Forbidden: insufficient role' });
      return null;
    }
  }

  // Read-only check
  if (acl.readonly && method !== 'GET') {
    res.status(403).json({ error: 'Forbidden: table is read-only' });
    return null;
  }

  // Build ownership filter for defense-in-depth (layered on top of RLS)
  // Admin users bypass ownership filters
  if (roles.includes('admin')) return {};

  if (acl.ownership_col) {
    return { ownershipCol: acl.ownership_col };
  }
  if (acl.alt_cols) {
    return { altCols: acl.alt_cols };
  }
  return {};
}

// ──────────────────────────────────────────────
// CORS
// ──────────────────────────────────────────────
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const defaultOrigins = [
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:5173',
];
const allowedOrigins = corsOrigins.length > 0 ? corsOrigins : defaultOrigins;

app.use(helmet());

// ── Structured request logging with correlation IDs ──
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customProps: (req) => ({ userId: req.userId || undefined }),
  serializers: {
    req: (req) => ({ method: req.method, url: req.url, id: req.id }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));

// ── Rate limiting ──
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
// Per-user rate limiter (keyed on userId after auth, falls back to IP)
const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => req.userId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests for this user' },
});
app.use(globalLimiter);
app.use('/rpc/', strictLimiter);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Prefer'],
  })
);
app.use(express.json({ limit: '10mb' }));

// ──────────────────────────────────────────────
// Health check (no auth)
// ──────────────────────────────────────────────
async function readinessCheck(_req, res) {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const dbLatencyMs = Date.now() - start;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: { status: 'connected', latencyMs: dbLatencyMs },
      pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      db: { status: 'disconnected', error: safeError(err) },
    });
  }
}
app.get('/health/ready', readinessCheck);
app.get('/health', readinessCheck); // backward-compat alias
app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));

// Sentry DSN for frontend (no auth; returns null if not configured)
app.get('/api/get-sentry-dsn', (_req, res) => {
  const dsn = (process.env.SENTRY_DSN || process.env.SENTRY_PUBLIC_DSN || '').trim() || null;
  res.json({ dsn });
});

// ── API documentation (Swagger UI) ──
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const { default: swaggerUi } = await import('swagger-ui-express');
  const { default: yaml } = await import('js-yaml');
  const openapiYaml = readFileSync(join(__dirname, '..', 'openapi.yaml'), 'utf8');
  const openapiDoc = yaml.load(openapiYaml);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDoc, {
    customSiteTitle: 'Pillaxia API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  }));
} catch (docErr) {
  logger.warn({ err: docErr }, 'API docs not available (missing openapi.yaml or swagger-ui-express)');
  app.get('/docs', (_req, res) => res.status(503).json({ error: 'API documentation not available' }));
}

// ──────────────────────────────────────────────
// PostgREST-style query param parser
// ──────────────────────────────────────────────
const MAX_LIMIT = 1000;

// ── FK relationship cache (populated once from information_schema) ──
// NOTE: Uses pool.query intentionally — information_schema is not subject to RLS.
// This is safe because it only reads schema metadata, not user data.
let _fkCache = null;
async function getFkMap() {
  if (_fkCache) return _fkCache;
  const sql = `
    SELECT
      kcu.table_name  AS src_table,
      kcu.column_name AS src_col,
      ccu.table_name  AS dst_table,
      ccu.column_name AS dst_col,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage    kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`;
  try {
    const { rows } = await pool.query(sql);
    _fkCache = rows;
  } catch (e) {
    logger.error({ err: e }, 'FK cache load failed');
    _fkCache = [];
  }
  return _fkCache;
}

/**
 * Parse PostgREST-style select tokens, separating plain columns from
 * embedded resource (join) specs.
 *
 * Supported patterns:
 *   medication_schedules(time_of_day,quantity)
 *   pharmacy_locations!drug_transfers_source_pharmacy_id_fkey(id,name)
 *   source_pharmacy:pharmacy_locations!fk_name(id,name)
 *
 * Returns { plainCols: string[], joins: JoinSpec[] }
 * where JoinSpec = { alias, relation, fkConstraint, columns }
 */
function parseSelectTokens(rawSelect) {
  const plainCols = [];
  const joins = [];
  if (!rawSelect) return { plainCols: ['*'], joins };

  // Tokenize respecting parentheses: split on commas that are NOT inside parens
  const tokens = [];
  let depth = 0;
  let cur = '';
  for (const ch of rawSelect) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      tokens.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) tokens.push(cur.trim());

  for (const tok of tokens) {
    // Match: [alias:]relation[!fk_name](col1,col2,...)
    const joinRe = /^(?:([a-zA-Z_][a-zA-Z0-9_]*):)?([a-zA-Z_][a-zA-Z0-9_]*)(?:!([a-zA-Z_][a-zA-Z0-9_]*))?(?:\((.+)\))?$/;
    const m = tok.match(joinRe);

    if (m && m[4] !== undefined) {
      // This is a join spec (has parenthesized columns)
      const alias = m[1] || m[2]; // default alias = relation name
      const relation = m[2];
      const fkConstraint = m[3] || null;
      const columns = m[4].split(',').map((c) => c.trim().replace(/[^a-zA-Z0-9_*]/g, '')).filter(Boolean);
      joins.push({ alias, relation, fkConstraint, columns });
    } else {
      // Plain column – sanitize
      const clean = tok.replace(/[^a-zA-Z0-9_*]/g, '');
      if (clean) plainCols.push(clean);
    }
  }

  if (plainCols.length === 0 && joins.length > 0) plainCols.push('*');
  if (plainCols.length === 0) plainCols.push('*');
  return { plainCols, joins };
}

/**
 * Resolve join specs to SQL LEFT JOIN clauses using the FK cache.
 * Returns { joinClauses: string[], joinSelectCols: string[], joinMeta: [] }
 */
async function resolveJoins(baseTable, joinSpecs) {
  const fks = await getFkMap();
  const schema = await getSchemaMap();
  const joinClauses = [];
  const joinSelectCols = [];
  const joinMeta = []; // { alias, relation, columns, prefix }

  for (const spec of joinSpecs) {
    const { alias, relation, fkConstraint, columns } = spec;
    const prefix = `__j_${alias}_`;

    // ── Whitelist: validate relation table exists in schema ──
    if (!schema[relation]) {
      throw new Error(`Unknown join table: ${relation}`);
    }

    // ── Whitelist: validate join columns exist in the relation table ──
    if (!columns.includes('*')) {
      const tableSchema = schema[relation];
      for (const col of columns) {
        if (!tableSchema.has(col)) {
          throw new Error(`Unknown column "${col}" in table "${relation}"`);
        }
      }
    }

    // Find FK relationship — could go either direction
    let fk = null;
    if (fkConstraint) {
      fk = fks.find((f) => f.constraint_name === fkConstraint);
    }
    if (!fk) {
      // base table has FK pointing to relation  (e.g. medications.pharmacy_id -> pharmacy_locations.id)
      fk = fks.find((f) => f.src_table === baseTable && f.dst_table === relation);
    }
    if (!fk) {
      // relation has FK pointing back to base table (e.g. medication_schedules.medication_id -> medications.id)
      fk = fks.find((f) => f.src_table === relation && f.dst_table === baseTable);
    }
    if (!fk) {
      logger.warn({ baseTable, relation }, 'No FK found for join');
      continue;
    }

    // Determine join condition
    let onClause;
    if (fk.src_table === baseTable) {
      // base -> relation  (e.g. medications.pharmacy_id = pharmacy_locations.id)
      onClause = `"${alias}"."${fk.dst_col}" = __base."${fk.src_col}"`;
    } else {
      // relation -> base  (e.g. medication_schedules.medication_id = medications.id)
      onClause = `"${alias}"."${fk.src_col}" = __base."${fk.dst_col}"`;
    }

    joinClauses.push(`LEFT JOIN public."${relation}" AS "${alias}" ON ${onClause}`);

    // Build prefixed select columns for the joined table
    const cols = columns.includes('*')
      ? ['*'] // handled below
      : columns;

    if (cols.includes('*')) {
      joinSelectCols.push(`row_to_json("${alias}".*) AS "${prefix}row"`);
    } else {
      for (const c of cols) {
        joinSelectCols.push(`"${alias}"."${c}" AS "${prefix}${c}"`);
      }
    }

    joinMeta.push({ alias, relation, columns: cols, prefix, isStarJoin: cols.includes('*') });
  }

  return { joinClauses, joinSelectCols, joinMeta };
}

/**
 * Post-process flat SQL rows into nested JSON with joined relations.
 * Groups child rows into arrays keyed by the join alias.
 */
function nestJoinResults(rows, baseTable, joinMeta) {
  if (!joinMeta.length) return rows;

  // Determine base table primary key column (default "id")
  const pkCol = 'id';
  const resultMap = new Map(); // pk -> merged parent row

  for (const row of rows) {
    const pk = row[pkCol];
    if (!resultMap.has(pk)) {
      // Extract base columns (strip the __base. prefix is not needed since we alias)
      const baseRow = {};
      for (const [k, v] of Object.entries(row)) {
        if (!k.startsWith('__j_')) baseRow[k] = v;
      }
      // Initialize join arrays
      for (const jm of joinMeta) baseRow[jm.alias] = [];
      resultMap.set(pk, baseRow);
    }

    const parent = resultMap.get(pk);

    // Collect joined data
    for (const jm of joinMeta) {
      if (jm.isStarJoin) {
        const rowJson = row[`${jm.prefix}row`];
        if (rowJson && rowJson.id != null) {
          // Avoid duplicates
          if (!parent[jm.alias].some((r) => r.id === rowJson.id)) {
            parent[jm.alias].push(rowJson);
          }
        }
      } else {
        const child = {};
        let hasValue = false;
        for (const c of jm.columns) {
          const prefixed = `${jm.prefix}${c}`;
          child[c] = row[prefixed] !== undefined ? row[prefixed] : null;
          if (row[prefixed] != null) hasValue = true;
        }
        if (hasValue) {
          // De-duplicate by checking if this exact child is already present
          const childJson = JSON.stringify(child);
          if (!parent[jm.alias].some((r) => JSON.stringify(r) === childJson)) {
            parent[jm.alias].push(child);
          }
        }
      }
    }
  }

  return Array.from(resultMap.values());
}

/**
 * Parse a PostgREST-style OR filter string:  (col.op.val,col.op.val)
 * Returns a SQL fragment like:  ("col1" = $N OR "col2" = $M)
 */
function parseOrFilter(orStr, values) {
  const inner = orStr.replace(/^\(/, '').replace(/\)$/, '');
  const parts = inner.split(',');
  const clauses = [];

  for (const part of parts) {
    const trimmed = part.trim();
    const dotIdx = trimmed.indexOf('.');
    if (dotIdx < 0) continue;
    const col = trimmed.slice(0, dotIdx).replace(/[^a-zA-Z0-9_]/g, '');
    const rest = trimmed.slice(dotIdx + 1);

    if (rest.startsWith('eq.')) {
      values.push(rest.slice(3));
      clauses.push(`"${col}" = $${values.length}`);
    } else if (rest.startsWith('neq.')) {
      values.push(rest.slice(4));
      clauses.push(`"${col}" != $${values.length}`);
    } else if (rest.startsWith('gt.')) {
      values.push(rest.slice(3));
      clauses.push(`"${col}" > $${values.length}`);
    } else if (rest.startsWith('gte.')) {
      values.push(rest.slice(4));
      clauses.push(`"${col}" >= $${values.length}`);
    } else if (rest.startsWith('lt.')) {
      values.push(rest.slice(3));
      clauses.push(`"${col}" < $${values.length}`);
    } else if (rest.startsWith('lte.')) {
      values.push(rest.slice(4));
      clauses.push(`"${col}" <= $${values.length}`);
    } else if (rest.startsWith('is.')) {
      const v = rest.slice(3).toLowerCase();
      if (v === 'null') clauses.push(`"${col}" IS NULL`);
      else if (v === 'true') clauses.push(`"${col}" IS TRUE`);
      else if (v === 'false') clauses.push(`"${col}" IS FALSE`);
    } else if (rest.startsWith('ilike.')) {
      values.push(rest.slice(6));
      clauses.push(`"${col}" ILIKE $${values.length}`);
    }
  }

  if (clauses.length === 0) return null;
  return `(${clauses.join(' OR ')})`;
}

function parsePostgrestFilters(query) {
  const filters = [];
  const values = [];
  let rawSelect = null;
  let limit = null;
  let orderBy = null;

  for (const [key, val] of Object.entries(query)) {
    if (key === 'select') {
      rawSelect = val;
      continue;
    }
    if (key === 'limit') {
      limit = Math.min(parseInt(val, 10) || MAX_LIMIT, MAX_LIMIT);
      continue;
    }
    if (key === 'order') {
      const parts = val.split('.');
      const col = parts[0].replace(/[^a-zA-Z0-9_]/g, '');
      const dir = parts[1]?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      orderBy = `"${col}" ${dir}`;
      continue;
    }
    // OR filter
    if (key === 'or') {
      const orClause = parseOrFilter(val, values);
      if (orClause) filters.push(orClause);
      continue;
    }
    // Column filter
    const colName = key.replace(/[^a-zA-Z0-9_]/g, '');
    if (typeof val === 'string' && val.startsWith('eq.')) {
      values.push(val.slice(3));
      filters.push(`"${colName}" = $${values.length}`);
    } else if (typeof val === 'string' && val.startsWith('neq.')) {
      values.push(val.slice(4));
      filters.push(`"${colName}" != $${values.length}`);
    } else if (typeof val === 'string' && val.startsWith('gt.')) {
      values.push(val.slice(3));
      filters.push(`"${colName}" > $${values.length}`);
    } else if (typeof val === 'string' && val.startsWith('gte.')) {
      values.push(val.slice(4));
      filters.push(`"${colName}" >= $${values.length}`);
    } else if (typeof val === 'string' && val.startsWith('lt.')) {
      values.push(val.slice(3));
      filters.push(`"${colName}" < $${values.length}`);
    } else if (typeof val === 'string' && val.startsWith('lte.')) {
      values.push(val.slice(4));
      filters.push(`"${colName}" <= $${values.length}`);
    } else if (typeof val === 'string' && val.startsWith('in.')) {
      const inner = val.slice(3).replace(/^\(/, '').replace(/\)$/, '');
      const items = inner.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      values.push(items);
      filters.push(`"${colName}" = ANY($${values.length})`);
    } else if (typeof val === 'string' && val.startsWith('is.')) {
      const v = val.slice(3).toLowerCase();
      if (v === 'null') filters.push(`"${colName}" IS NULL`);
      else if (v === 'true') filters.push(`"${colName}" IS TRUE`);
      else if (v === 'false') filters.push(`"${colName}" IS FALSE`);
    } else if (typeof val === 'string' && val.startsWith('not.is.')) {
      const v = val.slice(7).toLowerCase();
      if (v === 'null') filters.push(`"${colName}" IS NOT NULL`);
    } else if (typeof val === 'string' && val.startsWith('ilike.')) {
      values.push(val.slice(6));
      filters.push(`"${colName}" ILIKE $${values.length}`);
    }
  }

  // Enforce max limit
  if (!limit) limit = MAX_LIMIT;

  // Parse select tokens to separate plain columns from join specs
  const { plainCols, joins } = parseSelectTokens(rawSelect);
  const selectCols = plainCols.join(', ');

  return { selectCols, filters, values, limit, orderBy, joins };
}

// ──────────────────────────────────────────────
// Zod schemas for critical table request body validation
// ──────────────────────────────────────────────
const BODY_SCHEMAS = {
  profiles: z.object({
    first_name: z.string().max(100).optional(),
    last_name: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
    language_preference: z.enum(['en', 'fr', 'ha', 'ig', 'yo']).optional(),
    avatar_url: z.string().url().max(500).optional().nullable(),
    organization_id: z.string().uuid().optional().nullable(),
    is_active: z.boolean().optional(),
    job_title: z.string().max(200).optional().nullable(),
    license_number: z.string().max(100).optional().nullable(),
    license_expiration_date: z.string().optional().nullable(),
    address_line1: z.string().max(255).optional().nullable(),
    address_line2: z.string().max(255).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    postal_code: z.string().max(20).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
    timezone: z.string().max(100).optional().nullable(),
  }),
  medications: z.object({
    name: z.string().min(1).max(255),
    dosage: z.string().max(100).optional(),
    dosage_unit: z.string().max(50).optional(),
    form: z.string().max(50).optional(),
    instructions: z.string().max(2000).optional().nullable(),
    user_id: z.string().uuid().optional(),
    prescriber_user_id: z.string().uuid().optional().nullable(),
    pharmacy_id: z.string().uuid().optional().nullable(),
    refills_remaining: z.number().int().min(0).optional().nullable(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    is_active: z.boolean().optional(),
  }),
  appointments: z.object({
    patient_user_id: z.string().uuid(),
    clinician_user_id: z.string().uuid(),
    title: z.string().max(255).optional(),
    description: z.string().max(2000).optional().nullable(),
    appointment_date: z.string().optional(),
    appointment_time: z.string().optional(),
    appointment_type: z.string().max(100).optional(),
    status: z.enum(['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show']).optional(),
    notes: z.string().max(2000).optional().nullable(),
    duration_minutes: z.number().int().min(1).max(480).optional(),
    location: z.string().max(500).optional().nullable(),
    is_video_call: z.boolean().optional(),
    video_room_id: z.string().uuid().optional().nullable(),
  }),
  patient_notification_preferences: z.object({
    user_id: z.string().uuid().optional(),
    email_reminders: z.boolean().optional(),
    in_app_reminders: z.boolean().optional(),
    email_missed_alerts: z.boolean().optional(),
    in_app_missed_alerts: z.boolean().optional(),
    email_encouragements: z.boolean().optional(),
    in_app_encouragements: z.boolean().optional(),
    quiet_hours_enabled: z.boolean().optional(),
    quiet_hours_start: z.string().max(10).optional().nullable(),
    quiet_hours_end: z.string().max(10).optional().nullable(),
  }),
  caregiver_invitations: z.object({
    patient_user_id: z.string().uuid(),
    caregiver_email: z.string().email(),
    caregiver_name: z.string().max(200).optional().nullable(),
    permissions: z.record(z.boolean()).optional(),
    status: z.enum(['pending', 'accepted', 'declined', 'revoked']).optional(),
  }),
  symptom_entries: z.object({
    user_id: z.string().uuid().optional(),
    symptom_type: z.string().min(1).max(200),
    severity: z.number().int().min(1).max(10),
    description: z.string().max(2000).optional().nullable(),
    medication_id: z.string().uuid().optional().nullable(),
  }),
};

/**
 * Validate request body against Zod schema if one exists for the table.
 * Returns { success: true, data } or { success: false, errors }.
 */
function validateBody(table, body) {
  const schema = BODY_SCHEMAS[table];
  if (!schema) return { success: true, data: body }; // No schema = fallback to column-name validation

  const result = schema.safeParse(body);
  if (result.success) return { success: true, data: result.data };
  const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
  return { success: false, errors };
}

// ──────────────────────────────────────────────
// Zod schemas for RPC endpoint parameter validation
// ──────────────────────────────────────────────
const RPC_SCHEMAS = {
  is_device_trusted: z.object({
    p_user_id: z.string().uuid().optional(),
    p_device_token_hash: z.string().min(1).max(512),
  }),
  trust_device: z.object({
    p_user_id: z.string().uuid().optional(),
    p_device_token_hash: z.string().min(1).max(512),
    p_device_name: z.string().max(255).optional(),
    p_browser: z.string().max(255).optional(),
    p_operating_system: z.string().max(255).optional(),
    p_ip_address: z.string().max(45).optional(),
    p_expires_in_days: z.number().int().min(1).max(365).optional(),
  }),
  revoke_trusted_device: z.object({
    p_device_id: z.string().uuid(),
  }),
  revoke_all_trusted_devices: z.object({
    p_user_id: z.string().uuid().optional(),
  }),
  log_security_event: z.object({
    p_user_id: z.string().uuid().optional(),
    p_event_type: z.string().min(1).max(100),
    p_event_category: z.string().max(100).optional(),
    p_severity: z.string().max(50).optional(),
    p_description: z.string().max(2000).optional(),
    p_ip_address: z.string().max(45).optional(),
    p_user_agent: z.string().max(500).optional(),
    p_metadata: z.record(z.unknown()).optional(),
  }),
  log_data_access: z.object({
    p_user_id: z.string().uuid().optional(),
    p_accessed_table: z.string().min(1).max(100),
    p_accessed_record_id: z.string().uuid().optional().nullable(),
    p_access_type: z.string().min(1).max(50),
    p_data_category: z.string().max(100).optional(),
    p_patient_id: z.string().uuid().optional().nullable(),
    p_reason: z.string().max(500).optional(),
    p_ip_address: z.string().max(45).optional(),
    p_user_agent: z.string().max(500).optional(),
  }),
  record_login_attempt: z.object({
    p_email: z.string().email().max(255),
    p_user_id: z.string().uuid().optional().nullable(),
    p_ip_address: z.string().max(45).optional(),
    p_user_agent: z.string().max(500).optional(),
    p_success: z.boolean(),
  }),
  check_account_locked: z.object({
    p_email: z.string().email().max(255),
  }),
};

/**
 * Validate RPC request body against Zod schema.
 * Returns { success: true, data } or { success: false, errors }.
 */
function validateRpc(name, body) {
  const schema = RPC_SCHEMAS[name];
  if (!schema) return { success: true, data: body };
  const result = schema.safeParse(body);
  if (result.success) return { success: true, data: result.data };
  const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
  return { success: false, errors };
}

// ──────────────────────────────────────────────
// REST routes – Direct PostgreSQL (replaces PostgREST)
// ──────────────────────────────────────────────

// Apply per-user rate limiting after auth on REST and RPC routes
app.use('/rest/', authMiddleware, userLimiter);
app.use('/rpc/', authMiddleware, userLimiter);
// Apply per-user rate limiting on storage routes
app.use('/storage/', authMiddleware, userLimiter);

// GET /rest/:table – SELECT (with PostgREST embedded resource / join support)
app.get('/rest/:table', async (req, res) => {
  const table = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
  const access = await enforceTableAccess(req, res, table, 'GET');
  if (!access) return;

  const { selectCols, filters, values, limit, orderBy, joins } = parsePostgrestFilters(req.query);

  // Inject ownership filter for defense-in-depth
  if (access.ownershipCol) {
    values.push(req.userId);
    filters.push(`"${access.ownershipCol}" = $${values.length}`);
  } else if (access.altCols) {
    const clauses = access.altCols.map(c => { values.push(req.userId); return `"${c}" = $${values.length}`; });
    filters.push(`(${clauses.join(' OR ')})`);
  }

  // Phase 3: transparent read-through for profiles -> profiles_with_email view
  const readTable = (table === 'profiles') ? 'profiles_with_email' : table;

  try {
    if (joins && joins.length > 0) {
      // ── Build a join query ──
      const { joinClauses, joinSelectCols, joinMeta } = await resolveJoins(table, joins);

      // Prefix base table columns with alias
      const baseCols = selectCols === '*'
        ? '__base.*'
        : selectCols.split(',').map((c) => `__base.${c.trim()}`).join(', ');
      const allCols = [baseCols, ...joinSelectCols].join(', ');

      let sql = `SELECT ${allCols} FROM public."${readTable}" AS __base`;
      sql += ' ' + joinClauses.join(' ');
      if (filters.length > 0) {
        // Prefix unqualified filter columns with __base
        const prefixedFilters = filters.map((f) => f.replace(/"([a-zA-Z0-9_]+)"/g, '__base."$1"'));
        sql += ` WHERE ${prefixedFilters.join(' AND ')}`;
      }
      if (orderBy) sql += ` ORDER BY __base.${orderBy}`;
      sql += ` LIMIT ${limit}`;

      const result = await secureQuery(req.userId, sql, values);
      const nested = nestJoinResults(result.rows, table, joinMeta);
      res.json(nested);
    } else {
      // ── Simple query (no joins) ──
      let sql = `SELECT ${selectCols} FROM public."${readTable}"`;
      if (filters.length > 0) sql += ` WHERE ${filters.join(' AND ')}`;
      if (orderBy) sql += ` ORDER BY ${orderBy}`;
      sql += ` LIMIT ${limit}`;

      const result = await secureQuery(req.userId, sql, values);
      res.json(result.rows);
    }
  } catch (err) {
    logger.error({ err, table: req.params.table }, 'REST GET error');
    res.status(400).json({ error: safeError(err) });
  }
});

// POST /rest/:table – INSERT
app.post('/rest/:table', async (req, res) => {
  const table = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
  const access = await enforceTableAccess(req, res, table, 'POST');
  if (!access) return;

  const body = req.body;
  if (!body || typeof body !== 'object')
    return res.status(400).json({ error: 'JSON body required' });

  // Validate with Zod schema if available (type + value validation)
  const zodResult = validateBody(table, body);
  if (!zodResult.success) {
    return res.status(400).json({ error: 'Validation failed', details: zodResult.errors });
  }

  // Validate request body columns against schema (fallback for tables without Zod)
  const schema = await getSchemaMap();
  const tableSchema = schema[table];
  if (tableSchema) {
    const invalidCols = Object.keys(body).filter(c => !tableSchema.has(c));
    if (invalidCols.length > 0) {
      return res.status(400).json({ error: `Unknown columns: ${invalidCols.join(', ')}` });
    }
  }

  const cols = Object.keys(body).map((c) => `"${c.replace(/[^a-zA-Z0-9_]/g, '')}"`);
  const vals = Object.values(body);
  const placeholders = vals.map((_, i) => `$${i + 1}`);
  const sql = `INSERT INTO public."${table}" (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

  try {
    const result = await secureQuery(req.userId, sql, vals);
    res.status(201).json(result.rows);
  } catch (err) {
    logger.error({ err, table: req.params.table }, 'REST POST error');
    res.status(400).json({ error: safeError(err) });
  }
});

// PATCH /rest/:table – UPDATE with filters
app.patch('/rest/:table', async (req, res) => {
  const table = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
  const access = await enforceTableAccess(req, res, table, 'PATCH');
  if (!access) return;

  const body = req.body;
  if (!body || typeof body !== 'object')
    return res.status(400).json({ error: 'JSON body required' });

  // Validate with Zod schema if available (partial for PATCH)
  const zodSchema = BODY_SCHEMAS[table];
  if (zodSchema) {
    const partialResult = zodSchema.partial().safeParse(body);
    if (!partialResult.success) {
      const errors = partialResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
  }

  // Validate request body columns against schema (fallback for tables without Zod)
  const schema = await getSchemaMap();
  const tableSchema = schema[table];
  if (tableSchema) {
    const invalidCols = Object.keys(body).filter(c => !tableSchema.has(c));
    if (invalidCols.length > 0) {
      return res.status(400).json({ error: `Unknown columns: ${invalidCols.join(', ')}` });
    }
  }

  const { filters, values: filterValues } = parsePostgrestFilters(req.query);

  // Inject ownership filter for defense-in-depth
  if (access.ownershipCol) {
    filterValues.push(req.userId);
    filters.push(`"${access.ownershipCol}" = $${filterValues.length}`);
  } else if (access.altCols) {
    const clauses = access.altCols.map(c => { filterValues.push(req.userId); return `"${c}" = $${filterValues.length}`; });
    filters.push(`(${clauses.join(' OR ')})`);
  }

  if (filters.length === 0)
    return res.status(400).json({ error: 'Filters required for PATCH' });

  const setCols = Object.keys(body);
  const setVals = Object.values(body);
  const offset = filterValues.length;
  const setClause = setCols
    .map((c, i) => `"${c.replace(/[^a-zA-Z0-9_]/g, '')}" = $${offset + i + 1}`)
    .join(', ');
  const allValues = [...filterValues, ...setVals];

  const sql = `UPDATE public."${table}" SET ${setClause} WHERE ${filters.join(' AND ')} RETURNING *`;

  try {
    const result = await secureQuery(req.userId, sql, allValues);
    res.json(result.rows);
  } catch (err) {
    logger.error({ err, table: req.params.table }, 'REST PATCH error');
    res.status(400).json({ error: safeError(err) });
  }
});

// DELETE /rest/:table – DELETE with filters
app.delete('/rest/:table', async (req, res) => {
  const table = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
  const access = await enforceTableAccess(req, res, table, 'DELETE');
  if (!access) return;

  const { filters, values } = parsePostgrestFilters(req.query);

  // Inject ownership filter for defense-in-depth
  if (access.ownershipCol) {
    values.push(req.userId);
    filters.push(`"${access.ownershipCol}" = $${values.length}`);
  } else if (access.altCols) {
    const clauses = access.altCols.map(c => { values.push(req.userId); return `"${c}" = $${values.length}`; });
    filters.push(`(${clauses.join(' OR ')})`);
  }

  if (filters.length === 0)
    return res.status(400).json({ error: 'Filters required for DELETE' });

  const sql = `DELETE FROM public."${table}" WHERE ${filters.join(' AND ')}`;
  try {
    await secureQuery(req.userId, sql, values);
    res.status(204).send();
  } catch (err) {
    logger.error({ err, table: req.params.table }, 'REST DELETE error');
    res.status(400).json({ error: safeError(err) });
  }
});

// ──────────────────────────────────────────────
// RPC endpoints – replace Supabase .rpc() calls
// ──────────────────────────────────────────────

// User sync
app.post('/rpc/upsert_user_from_jwt', async (req, res) => {
  try {
    await syncUserFromJwt(req.jwtClaims);
    res.json({ id: req.userId });
  } catch (err) {
    logger.error({ err }, 'upsert_user_from_jwt error');
    res.status(500).json({ error: safeError(err) });
  }
});

// Trusted devices
app.post('/rpc/is_device_trusted', async (req, res) => {
  try {
    const v = validateRpc('is_device_trusted', req.body);
    if (!v.success) return res.status(400).json({ error: 'Validation failed', details: v.errors });
    const { p_user_id, p_device_token_hash } = v.data;
    const result = await secureQuery(req.userId,
      'SELECT public.is_device_trusted($1::uuid, $2) AS trusted',
      [p_user_id || req.userId, p_device_token_hash]
    );
    res.json(result.rows[0]?.trusted ?? false);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

app.post('/rpc/trust_device', async (req, res) => {
  try {
    const v = validateRpc('trust_device', req.body);
    if (!v.success) return res.status(400).json({ error: 'Validation failed', details: v.errors });
    const { p_user_id, p_device_token_hash, p_device_name, p_browser, p_operating_system, p_ip_address, p_expires_in_days } = v.data;
    const result = await secureQuery(req.userId,
      'SELECT public.trust_device($1::uuid, $2, $3, $4, $5, $6, $7) AS device_id',
      [p_user_id || req.userId, p_device_token_hash, p_device_name, p_browser, p_operating_system, p_ip_address, p_expires_in_days || 30]
    );
    res.json(result.rows[0]?.device_id);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

app.post('/rpc/revoke_trusted_device', async (req, res) => {
  try {
    const v = validateRpc('revoke_trusted_device', req.body);
    if (!v.success) return res.status(400).json({ error: 'Validation failed', details: v.errors });
    const { p_device_id } = v.data;
    const result = await secureQuery(req.userId,
      'SELECT public.revoke_trusted_device($1::uuid) AS success',
      [p_device_id]
    );
    res.json(result.rows[0]?.success ?? false);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

app.post('/rpc/revoke_all_trusted_devices', async (req, res) => {
  try {
    const v = validateRpc('revoke_all_trusted_devices', req.body);
    if (!v.success) return res.status(400).json({ error: 'Validation failed', details: v.errors });
    const { p_user_id } = v.data;
    const result = await secureQuery(req.userId,
      'SELECT public.revoke_all_trusted_devices($1::uuid) AS count',
      [p_user_id || req.userId]
    );
    res.json(result.rows[0]?.count ?? 0);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// Security events
app.post('/rpc/log_security_event', async (req, res) => {
  try {
    const v = validateRpc('log_security_event', req.body);
    if (!v.success) return res.status(400).json({ error: 'Validation failed', details: v.errors });
    const { p_user_id, p_event_type, p_event_category, p_severity, p_description, p_ip_address, p_user_agent, p_metadata } = v.data;
    const result = await secureQuery(req.userId,
      `SELECT public.log_security_event(
        $1::uuid, $2::security_event_type, $3, $4, $5, $6, $7, $8::jsonb
      ) AS event_id`,
      [p_user_id || req.userId, p_event_type, p_event_category || 'authentication', p_severity || 'info', p_description, p_ip_address, p_user_agent, JSON.stringify(p_metadata || {})]
    );
    res.json(result.rows[0]?.event_id);
  } catch (err) {
    logger.error({ err }, 'log_security_event error');
    res.status(500).json({ error: safeError(err) });
  }
});

app.post('/rpc/log_data_access', async (req, res) => {
  try {
    const v = validateRpc('log_data_access', req.body);
    if (!v.success) return res.status(400).json({ error: 'Validation failed', details: v.errors });
    const { p_user_id, p_accessed_table, p_accessed_record_id, p_access_type, p_data_category, p_patient_id, p_reason, p_ip_address, p_user_agent } = v.data;
    const result = await secureQuery(req.userId,
      `SELECT public.log_data_access(
        $1::uuid, $2, $3::uuid, $4, $5, $6::uuid, $7, $8, $9
      ) AS log_id`,
      [p_user_id || req.userId, p_accessed_table, p_accessed_record_id, p_access_type, p_data_category || 'general', p_patient_id, p_reason, p_ip_address, p_user_agent]
    );
    res.json(result.rows[0]?.log_id);
  } catch (err) {
    logger.error({ err }, 'log_data_access error');
    res.status(500).json({ error: safeError(err) });
  }
});

// Login attempts & account lockouts
app.post('/rpc/record_login_attempt', async (req, res) => {
  try {
    const v = validateRpc('record_login_attempt', req.body);
    if (!v.success) return res.status(400).json({ error: 'Validation failed', details: v.errors });
    const { p_email, p_user_id, p_ip_address, p_user_agent, p_success } = v.data;
    const result = await secureQuery(req.userId,
      'SELECT public.record_login_attempt($1, $2::uuid, $3, $4, $5) AS result',
      [p_email, p_user_id, p_ip_address, p_user_agent, p_success]
    );
    res.json(result.rows[0]?.result);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

app.post('/rpc/check_account_locked', async (req, res) => {
  try {
    const v = validateRpc('check_account_locked', req.body);
    if (!v.success) return res.status(400).json({ error: 'Validation failed', details: v.errors });
    const { p_email } = v.data;
    const result = await secureQuery(req.userId,
      'SELECT public.check_account_locked($1) AS result',
      [p_email]
    );
    res.json(result.rows[0]?.result);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// Prescription number generation
app.post('/rpc/generate_prescription_number', async (req, res) => {
  try {
    const roles = await getUserRoles(req.userId, req);
    if (!roles.includes('clinician') && !roles.includes('admin')) {
      return res.status(403).json({ error: 'Forbidden: clinician or admin role required' });
    }
    const result = await secureQuery(req.userId,
      'SELECT public.generate_prescription_number() AS prescription_number'
    );
    res.json(result.rows[0]?.prescription_number);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ──────────────────────────────────────────────
// Storage routes – Azure Blob proxy
// ──────────────────────────────────────────────
// ── Storage security constants ──
const ALLOWED_BUCKETS = new Set(['avatars', 'documents', 'attachments']);
const PATH_TRAVERSAL_RE = /\.\.|^\/|%2e%2e|%00/i;
const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/csv',
]);

app.put(
  '/storage/:bucket/:path(*)',
  express.raw({ type: '*/*', limit: '10mb' }),
  async (req, res) => {
    try {
      const { bucket, path: blobPath } = req.params;

      // Bucket whitelist
      if (!ALLOWED_BUCKETS.has(bucket))
        return res.status(403).json({ error: 'Forbidden bucket' });

      // Path traversal protection
      if (PATH_TRAVERSAL_RE.test(blobPath))
        return res.status(400).json({ error: 'Invalid path' });

      // Ownership enforcement: path must start with userId/
      if (!blobPath.startsWith(`${req.userId}/`))
        return res.status(403).json({ error: 'Forbidden: ownership required' });

      // File type validation
      const contentType = req.headers['content-type'] || 'application/octet-stream';
      const baseType = contentType.split(';')[0].trim().toLowerCase();
      if (!ALLOWED_UPLOAD_TYPES.has(baseType))
        return res.status(400).json({ error: `File type not allowed: ${baseType}` });

      const { BlobServiceClient } = await import('@azure/storage-blob');
      const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
      if (!connectionString)
        return res.status(503).json({ error: 'Storage not configured' });

      const blobService = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobService.getContainerClient(bucket);
      await containerClient.createIfNotExists({ access: 'blob' });
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
      await blockBlobClient.uploadData(
        Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || ''),
        { blobHTTPHeaders: { blobContentType: baseType } }
      );
      return res.json({ url: blockBlobClient.url });
    } catch (err) {
      logger.error({ err, bucket: req.params.bucket }, 'Storage upload error');
      return res.status(500).json({ error: safeError(err) });
    }
  }
);

app.delete('/storage/:bucket', express.json(), async (req, res) => {
  try {
    const { bucket } = req.params;

    // Bucket whitelist
    if (!ALLOWED_BUCKETS.has(bucket))
      return res.status(403).json({ error: 'Forbidden bucket' });

    const { BlobServiceClient } = await import('@azure/storage-blob');
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString)
      return res.status(503).json({ error: 'Storage not configured' });

    const blobService = BlobServiceClient.fromConnectionString(connectionString);
    const { paths } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0)
      return res.status(400).json({ error: 'paths array required' });

    // Validate all paths before deleting
    for (const p of paths) {
      if (PATH_TRAVERSAL_RE.test(p))
        return res.status(400).json({ error: 'Invalid path in paths array' });
      if (!p.startsWith(`${req.userId}/`))
        return res.status(403).json({ error: 'Forbidden: ownership required for all paths' });
    }

    const containerClient = blobService.getContainerClient(bucket);
    for (const p of paths) {
      await containerClient.getBlockBlobClient(p).deleteIfExists();
    }
    return res.status(204).send();
  } catch (err) {
    logger.error({ err, bucket: req.params.bucket }, 'Storage delete error');
    return res.status(500).json({ error: safeError(err) });
  }
});

// ──────────────────────────────────────────────
// Global error handler (must be last middleware)
// ──────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.error({ err, method: req.method, url: req.url, userId: req.userId }, 'Unhandled error');
  res.status(err.status || 500).json({ error: safeError(err) });
});

// ──────────────────────────────────────────────
// Start server
// ──────────────────────────────────────────────
// Export app for testing
export { app };

// Only start listening if not imported as a module (e.g. by tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info({
      port: PORT,
      database: process.env.DATABASE_URL ? 'configured' : 'NOT SET',
      b2cClient: process.env.AZURE_B2C_CLIENT_ID || 'not set',
      poolMax: process.env.PG_POOL_MAX || 20,
    }, 'Pillaxia API started');
  });
}
