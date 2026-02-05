/**
 * Pillaxia API - PostgREST proxy with Azure AD B2C JWT validation
 * - Validates Azure AD B2C JWT
 * - Syncs user to public.users on first request
 * - Proxies to PostgREST with JWT for RLS
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { BearerStrategy } from 'passport-azure-ad';
import passport from 'passport';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection for user sync
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

// Azure AD B2C configuration
const B2C_CONFIG = {
  identityMetadata: process.env.AZURE_B2C_METADATA || `https://${process.env.AZURE_B2C_TENANT}.b2clogin.com/${process.env.AZURE_B2C_TENANT}.onmicrosoft.com/${process.env.AZURE_B2C_POLICY}/v2.0/.well-known/openid-configuration`,
  clientID: process.env.AZURE_B2C_CLIENT_ID,
  audience: process.env.AZURE_B2C_CLIENT_ID,
  issuer: process.env.AZURE_B2C_ISSUER || `https://${process.env.AZURE_B2C_TENANT}.b2clogin.com/${process.env.AZURE_B2C_TENANT_ID}/v2.0/`,
  policyName: process.env.AZURE_B2C_POLICY || 'B2C_1_signin',
  passReqToCallback: false,
  validateIssuer: true,
  loggingLevel: 'error',
};

// PostgREST URL
const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:3001';

// Configure passport with Azure AD B2C Bearer strategy
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
  (token, done) => {
    done(null, token, token);
  }
);

passport.use(bearerStrategy);

// Sync user to public.users from JWT claims
async function syncUserFromJwt(claims) {
  const oid = claims.oid || claims.sub;
  if (!oid) return null;

  const email = claims.emails?.[0] || claims.email || claims.preferred_username;
  const rawUserMetaData = JSON.stringify({
    name: claims.name,
    given_name: claims.given_name,
    family_name: claims.family_name,
  });

  const client = await pool.connect();
  try {
    await client.query(
      'SELECT public.upsert_user_from_jwt($1::uuid, $2, $3::jsonb)',
      [oid, email, rawUserMetaData]
    );
    return oid;
  } finally {
    client.release();
  }
}

// Middleware: validate B2C JWT and sync user
const authMiddleware = (req, res, next) => {
  passport.authenticate('oauth-bearer', { session: false }, async (err, token, info) => {
    if (err) {
      return res.status(401).json({ error: 'Authentication failed', detail: err.message });
    }
    if (!token) {
      return res.status(401).json({ error: 'Invalid or missing token' });
    }

    req.user = token;
    req.jwtClaims = token;

    // Sync user to public.users
    try {
      await syncUserFromJwt(token);
    } catch (syncErr) {
      console.error('User sync error:', syncErr);
      // Continue - user may exist
    }

    next();
  })(req, res, next);
};

// Build PostgREST-compatible JWT for RLS
// PostgREST verifies with JWT_SECRET and passes payload as request.jwt.claims
function buildPostgrestJwt(b2cToken) {
  const claims = {
    role: 'authenticated',
    oid: b2cToken.oid || b2cToken.sub,
    sub: b2cToken.sub,
    email: b2cToken.emails?.[0] || b2cToken.email,
    exp: Math.floor(Date.now() / 1000) + 300,
    iat: Math.floor(Date.now() / 1000),
  };
  const secret = process.env.JWT_SECRET || process.env.POSTGREST_JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET or POSTGREST_JWT_SECRET required');
  return jwt.sign(claims, secret, { algorithm: 'HS256' });
}

// CORS: allow comma-separated origins; with credentials we must reflect a specific origin (not *)
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
// When CORS_ORIGIN is unset, allow localhost for local dev
const defaultOrigins = ['http://localhost:8080', 'http://localhost:5173', 'http://127.0.0.1:8080', 'http://127.0.0.1:5173'];
const allowedOrigins = corsOrigins.length > 0 ? corsOrigins : defaultOrigins;

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin or non-browser
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Prefer'],
}));
app.use(express.json({ limit: '10mb' }));

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API proxy - requires auth, forwards to PostgREST with JWT claims
app.use(
  '/rest/*',
  authMiddleware,
  createProxyMiddleware({
    target: POSTGREST_URL,
    changeOrigin: true,
    pathRewrite: { '^/rest': '' },
    onProxyReq: (proxyReq, req) => {
      // Sign JWT for PostgREST - PostgREST verifies and sets request.jwt.claims
      const postgrestToken = buildPostgrestJwt(req.jwtClaims);
      proxyReq.setHeader('Authorization', `Bearer ${postgrestToken}`);
    },
  })
);

// Storage routes - Azure Blob proxy (requires auth)
app.put('/storage/:bucket/:path(*)', authMiddleware, express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
  try {
    const { BlobServiceClient } = await import('@azure/storage-blob');
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) return res.status(503).json({ error: 'Storage not configured' });
    const blobService = BlobServiceClient.fromConnectionString(connectionString);
    const { bucket, path } = req.params;
    const containerClient = blobService.getContainerClient(bucket);
    await containerClient.createIfNotExists({ access: 'blob' });
    const blockBlobClient = containerClient.getBlockBlobClient(path);
    await blockBlobClient.uploadData(Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || ''));
    return res.json({ url: blockBlobClient.url });
  } catch (err) {
    console.error('Storage upload error:', err);
    return res.status(500).json({ error: err.message });
  }
});
app.delete('/storage/:bucket', authMiddleware, express.json(), async (req, res) => {
  try {
    const { BlobServiceClient } = await import('@azure/storage-blob');
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) return res.status(503).json({ error: 'Storage not configured' });
    const blobService = BlobServiceClient.fromConnectionString(connectionString);
    const { bucket } = req.params;
    const { paths } = req.body || {};
    if (!Array.isArray(paths) || paths.length === 0) return res.status(400).json({ error: 'paths array required' });
    const containerClient = blobService.getContainerClient(bucket);
    for (const path of paths) {
      await containerClient.getBlockBlobClient(path).deleteIfExists();
    }
    return res.status(204).send();
  } catch (err) {
    console.error('Storage delete error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// RPC endpoint for user sync (called by client if needed)
app.post('/rpc/upsert_user_from_jwt', authMiddleware, async (req, res) => {
  try {
    const oid = req.jwtClaims.oid || req.jwtClaims.sub;
    await syncUserFromJwt(req.jwtClaims);
    res.json({ id: oid });
  } catch (err) {
    console.error('upsert_user_from_jwt error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Pillaxia API listening on port ${PORT}`);
  console.log(`  PostgREST: ${POSTGREST_URL}`);
  console.log(`  B2C tenant: ${process.env.AZURE_B2C_TENANT || 'not set'}`);
});
