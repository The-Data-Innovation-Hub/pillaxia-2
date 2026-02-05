/**
 * Shared PostgreSQL client for Azure Functions
 * Replaces Supabase client for server-side DB access
 */

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function from(table) {
  return {
    select: (cols) => ({
      eq: (col, val) => ({
        gte: (c, v) => ({
          lte: async (c2, v2) => {
            const colList = cols.replace(/\s/g, '');
            const res = await query(
              `SELECT ${colList} FROM ${table} WHERE ${col} = $1 AND ${c} >= $2 AND ${c2} <= $3`,
              [val, v, v2]
            );
            return { data: res.rows, error: null };
          },
        }),
        maybeSingle: async () => {
          const res = await query(`SELECT ${cols} FROM ${table} WHERE ${col} = $1 LIMIT 1`, [val]);
          return { data: res.rows[0] || null, error: null };
        },
        single: async () => {
          const res = await query(`SELECT ${cols} FROM ${table} WHERE ${col} = $1 LIMIT 1`, [val]);
          return { data: res.rows[0] || null, error: res.rows.length ? null : new Error('Not found') };
        },
      }),
    }),
    insert: (data) => ({
      select: () => ({
        single: async () => {
          const keys = Object.keys(data);
          const vals = Object.values(data);
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const res = await query(
            `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            vals
          );
          return { data: res.rows[0], error: null };
        },
      }),
    }),
  };
}

export { pool };
