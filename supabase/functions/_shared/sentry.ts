/**
 * Enhanced Sentry utilities for Edge Functions
 * Provides error tracking, performance monitoring, and structured logging
 */

interface SentryEvent {
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename: string;
          function: string;
          lineno: number;
        }>;
      };
    }>;
  };
  message?: string;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  timestamp: number;
  platform: string;
  environment: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
    ip_address?: string;
  };
  transaction?: string;
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };
  fingerprint?: string[];
  contexts?: {
    runtime?: { name: string; version: string };
    trace?: { trace_id: string; span_id: string };
  };
}

interface SentryConfig {
  dsn: string;
  environment?: string;
  release?: string;
}

interface PerformanceSpan {
  name: string;
  startTime: number;
  data?: Record<string, unknown>;
}

// Parse DSN to get project details
function parseDsn(dsn: string): { publicKey: string; host: string; projectId: string } | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace('/', '');
    const host = url.host;
    return { publicKey, host, projectId };
  } catch {
    return null;
  }
}

// Generate trace IDs
function generateTraceId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function generateSpanId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

// Send event to Sentry
async function sendEvent(config: SentryConfig, event: SentryEvent): Promise<boolean> {
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
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=edge-function/2.0.0, sentry_key=${publicKey}`,
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

// Get Sentry configuration from environment
export function getSentryConfig(): SentryConfig | null {
  const dsn = Deno.env.get('SENTRY_DSN') || Deno.env.get('VITE_SENTRY_DSN');
  if (!dsn) {
    return null;
  }

  return {
    dsn,
    environment: Deno.env.get('ENVIRONMENT') || 'production',
    release: Deno.env.get('VERSION') || '2.0.0',
  };
}

// Capture an exception with enhanced context
export async function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id?: string; email?: string };
    request?: Request;
    functionName?: string;
    fingerprint?: string[];
    level?: 'fatal' | 'error' | 'warning';
  }
): Promise<boolean> {
  const config = getSentryConfig();
  if (!config) {
    console.warn('[Sentry] DSN not configured, skipping exception capture');
    console.error(`[${context?.functionName || 'edge-function'}] Error:`, error.message);
    return false;
  }

  const traceId = generateTraceId();
  const spanId = generateSpanId();

  const event: SentryEvent = {
    exception: {
      values: [
        {
          type: error.name || 'Error',
          value: error.message,
          stacktrace: error.stack
            ? { frames: parseStackTrace(error.stack) }
            : undefined,
        },
      ],
    },
    level: context?.level || 'error',
    timestamp: Date.now() / 1000,
    platform: 'deno',
    environment: config.environment || 'production',
    tags: {
      runtime: 'edge-function',
      function_name: context?.functionName || 'unknown',
      ...context?.tags,
    },
    extra: {
      deno_version: Deno.version.deno,
      ...context?.extra,
    },
    user: context?.user,
    transaction: context?.functionName,
    fingerprint: context?.fingerprint,
    contexts: {
      runtime: { name: 'Deno', version: Deno.version.deno },
      trace: { trace_id: traceId, span_id: spanId },
    },
  };

  if (context?.request) {
    const url = new URL(context.request.url);
    event.request = {
      url: `${url.pathname}${url.search}`, // Exclude host for security
      method: context.request.method,
      headers: Object.fromEntries(
        Array.from(context.request.headers.entries()).filter(
          ([key]) => !['authorization', 'cookie', 'x-api-key'].includes(key.toLowerCase())
        )
      ),
    };
  }

  console.log(`[Sentry] Capturing exception: ${error.message} (trace: ${traceId.slice(0, 8)})`);
  return sendEvent(config, event);
}

// Capture a message with level
export async function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    functionName?: string;
  }
): Promise<boolean> {
  const config = getSentryConfig();
  if (!config) {
    console.warn('[Sentry] DSN not configured, skipping message capture');
    return false;
  }

  const event: SentryEvent = {
    message,
    level,
    timestamp: Date.now() / 1000,
    platform: 'deno',
    environment: config.environment || 'production',
    tags: {
      runtime: 'edge-function',
      function_name: context?.functionName || 'unknown',
      ...context?.tags,
    },
    extra: context?.extra,
    transaction: context?.functionName,
    contexts: {
      runtime: { name: 'Deno', version: Deno.version.deno },
    },
  };

  console.log(`[Sentry] Capturing message (${level}): ${message}`);
  return sendEvent(config, event);
}

// Parse stack trace into Sentry frames format
function parseStackTrace(
  stack: string
): Array<{ filename: string; function: string; lineno: number }> {
  const frames: Array<{ filename: string; function: string; lineno: number }> = [];

  const lines = stack.split('\n');
  for (const line of lines) {
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+)(?::\d+)?\)?/);
    if (match) {
      frames.push({
        function: match[1] || '<anonymous>',
        filename: match[2],
        lineno: parseInt(match[3], 10),
      });
    }
  }

  return frames.reverse();
}

// Performance tracking helper
export function startSpan(name: string, data?: Record<string, unknown>): PerformanceSpan {
  return {
    name,
    startTime: performance.now(),
    data,
  };
}

export function finishSpan(span: PerformanceSpan): number {
  const duration = performance.now() - span.startTime;
  console.log(`[Performance] ${span.name}: ${duration.toFixed(2)}ms`);
  return duration;
}

// Enhanced wrapper with performance tracking and structured error handling
export function withSentry(
  functionName: string,
  handler: (req: Request) => Promise<Response>,
  options?: {
    captureAllErrors?: boolean;
    ignoredStatusCodes?: number[];
  }
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const span = startSpan(`${functionName}.handler`);
    
    try {
      const response = await handler(req);
      const duration = finishSpan(span);
      
      // Log slow requests
      if (duration > 5000) {
        await captureMessage(`Slow request: ${functionName} took ${duration.toFixed(0)}ms`, 'warning', {
          functionName,
          extra: { duration_ms: duration },
        });
      }
      
      // Optionally capture non-2xx responses as errors
      if (options?.captureAllErrors && !response.ok) {
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

// Batch operation helper for parallel processing
export async function withBatchProcessing<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options?: {
    batchSize?: number;
    functionName?: string;
  }
): Promise<{ results: R[]; errors: Array<{ item: T; error: Error }> }> {
  const batchSize = options?.batchSize || 10;
  const results: R[] = [];
  const errors: Array<{ item: T; error: Error }> = [];

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
        
        // Log but don't fail the batch
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
