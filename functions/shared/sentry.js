/**
 * Sentry utilities for Azure Functions
 * Ported from Supabase Edge Functions (_shared/sentry.ts)
 *
 * Provides error tracking, performance monitoring, and structured logging.
 * All Deno-specific APIs have been replaced with Node.js equivalents.
 */

import { randomUUID } from 'node:crypto';

// ============= Sentry Configuration =============

function parseDsn(dsn) {
  try {
    const url = new URL(dsn);
    return { publicKey: url.username, host: url.host, projectId: url.pathname.replace('/', '') };
  } catch {
    return null;
  }
}

function generateTraceId() {
  return randomUUID().replace(/-/g, '');
}

function generateSpanId() {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}

async function sendEvent(config, event) {
  const parsed = parseDsn(config.dsn);
  if (!parsed) {
    console.error('[Sentry] Invalid DSN');
    return false;
  }
  const { publicKey, host, projectId } = parsed;
  const endpoint = `https://${host}/api/${projectId}/store/`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=azure-function/2.0.0, sentry_key=${publicKey}`,
      },
      body: JSON.stringify({
        ...event,
        environment: config.environment || 'production',
        release: config.release,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Sentry] Failed to send event:', errorText);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Sentry] Error sending event:', error);
    return false;
  }
}

/** Get Sentry configuration from environment */
export function getSentryConfig() {
  const dsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN;
  if (!dsn) return null;
  return {
    dsn,
    environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'production',
    release: process.env.VERSION || '2.0.0',
  };
}

// ============= Exception & Message Capture =============

function parseStackTrace(stack) {
  const frames = [];
  for (const line of stack.split('\n')) {
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+)(?::\d+)?\)?/);
    if (match) {
      frames.push({ function: match[1] || '<anonymous>', filename: match[2], lineno: parseInt(match[3], 10) });
    }
  }
  return frames.reverse();
}

/**
 * Capture an exception and send to Sentry
 * @param {Error} error
 * @param {{ tags?: Record<string,string>, extra?: Record<string,unknown>, user?: { id?: string }, request?: Request, functionName?: string, fingerprint?: string[], level?: string }} [context]
 * @returns {Promise<boolean>}
 */
export async function captureException(error, context) {
  const config = getSentryConfig();
  if (!config) {
    console.warn('[Sentry] DSN not configured, skipping exception capture');
    console.error(`[${context?.functionName || 'azure-function'}] Error:`, error.message);
    return false;
  }

  const traceId = generateTraceId();
  const spanId = generateSpanId();

  const event = {
    exception: {
      values: [{
        type: error.name || 'Error',
        value: error.message,
        stacktrace: error.stack ? { frames: parseStackTrace(error.stack) } : undefined,
      }],
    },
    level: context?.level || 'error',
    timestamp: Date.now() / 1000,
    platform: 'node',
    environment: config.environment || 'production',
    tags: {
      runtime: 'azure-function',
      function_name: context?.functionName || 'unknown',
      ...context?.tags,
    },
    extra: { node_version: process.version, ...context?.extra },
    user: context?.user,
    transaction: context?.functionName,
    fingerprint: context?.fingerprint,
    contexts: {
      runtime: { name: 'Node.js', version: process.version },
      trace: { trace_id: traceId, span_id: spanId },
    },
  };

  if (context?.request) {
    const url = new URL(context.request.url);
    event.request = {
      url: `${url.pathname}${url.search}`,
      method: context.request.method,
      headers: Object.fromEntries(
        [...context.request.headers.entries()].filter(
          ([key]) => !['authorization', 'cookie', 'x-api-key'].includes(key.toLowerCase()),
        ),
      ),
    };
  }

  console.log(`[Sentry] Capturing exception: ${error.message} (trace: ${traceId.slice(0, 8)})`);
  return sendEvent(config, event);
}

/**
 * Capture a message with level
 * @param {string} message
 * @param {'fatal'|'error'|'warning'|'info'|'debug'} [level='info']
 * @param {{ tags?: Record<string,string>, extra?: Record<string,unknown>, functionName?: string }} [context]
 */
export async function captureMessage(message, level = 'info', context) {
  const config = getSentryConfig();
  if (!config) {
    console.warn('[Sentry] DSN not configured, skipping message capture');
    return false;
  }
  const event = {
    message,
    level,
    timestamp: Date.now() / 1000,
    platform: 'node',
    environment: config.environment || 'production',
    tags: { runtime: 'azure-function', function_name: context?.functionName || 'unknown', ...context?.tags },
    extra: context?.extra,
    transaction: context?.functionName,
    contexts: { runtime: { name: 'Node.js', version: process.version } },
  };
  console.log(`[Sentry] Capturing message (${level}): ${message}`);
  return sendEvent(config, event);
}

// ============= Performance =============

export function startSpan(name, data) {
  return { name, startTime: performance.now(), data };
}

export function finishSpan(span) {
  const duration = performance.now() - span.startTime;
  console.log(`[Performance] ${span.name}: ${duration.toFixed(2)}ms`);
  return duration;
}

/**
 * Wrap an Azure Function handler with Sentry error tracking & performance monitoring.
 * @param {string} functionName
 * @param {(req: import('@azure/functions').HttpRequest, context: import('@azure/functions').InvocationContext) => Promise<import('@azure/functions').HttpResponseInit>} handler
 * @param {{ captureAllErrors?: boolean, ignoredStatusCodes?: number[] }} [options]
 */
export function withSentry(functionName, handler, options) {
  return async (req, context) => {
    const span = startSpan(`${functionName}.handler`);
    try {
      const response = await handler(req, context);
      const duration = finishSpan(span);

      if (duration > 5000) {
        await captureMessage(`Slow request: ${functionName} took ${duration.toFixed(0)}ms`, 'warning', {
          functionName,
          extra: { duration_ms: duration },
        });
      }

      if (options?.captureAllErrors && response.status && response.status >= 400) {
        const ignoredCodes = options.ignoredStatusCodes || [400, 401, 403, 404];
        if (!ignoredCodes.includes(response.status)) {
          await captureMessage(`HTTP ${response.status} in ${functionName}`, 'error', {
            functionName,
            extra: { status: response.status },
          });
        }
      }

      return response;
    } catch (error) {
      finishSpan(span);
      await captureException(error instanceof Error ? error : new Error(String(error)), {
        functionName,
        request: req,
      });
      throw error;
    }
  };
}

// ============= Batch Processing =============

/**
 * Process items in batches with error collection
 * @template T, R
 * @param {T[]} items
 * @param {(item: T) => Promise<R>} processor
 * @param {{ batchSize?: number, functionName?: string }} [options]
 */
export async function withBatchProcessing(items, processor, options) {
  const batchSize = options?.batchSize || 10;
  const results = [];
  const errors = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(processor));

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
        errors.push({ item: batch[j], error });
        console.error(`[Batch] Item ${i + j} failed:`, error.message);
      }
    }
  }

  if (errors.length > 0 && options?.functionName) {
    await captureMessage(`Batch processing had ${errors.length} failures`, 'warning', {
      functionName: options.functionName,
      extra: { total: items.length, failures: errors.length, success: results.length },
    });
  }

  return { results, errors };
}

/**
 * Simple batch processor
 * @template T
 * @param {T[]} items
 * @param {number} batchSize
 * @param {(item: T) => Promise<void>} processor
 */
export async function processBatch(items, batchSize, processor) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processor));
  }
}
