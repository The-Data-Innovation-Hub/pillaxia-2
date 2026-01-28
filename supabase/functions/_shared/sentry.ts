// Sentry utilities for Edge Functions
// Note: Full Sentry SDK not available in Deno, using HTTP API directly

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
}

interface SentryConfig {
  dsn: string;
  environment?: string;
  release?: string;
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
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=edge-function/1.0.0, sentry_key=${publicKey}`,
      },
      body: JSON.stringify({
        ...event,
        environment: config.environment || 'production',
        release: config.release,
      }),
    });

    if (!response.ok) {
      console.error('[Sentry] Failed to send event:', await response.text());
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
  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) {
    return null;
  }

  return {
    dsn,
    environment: Deno.env.get('ENVIRONMENT') || 'production',
    release: Deno.env.get('VERSION') || '1.0.0',
  };
}

// Capture an exception
export async function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id?: string; email?: string };
    request?: Request;
    functionName?: string;
  }
): Promise<boolean> {
  const config = getSentryConfig();
  if (!config) {
    console.warn('[Sentry] DSN not configured, skipping exception capture');
    return false;
  }

  const event: SentryEvent = {
    exception: {
      values: [
        {
          type: error.name || 'Error',
          value: error.message,
          stacktrace: error.stack
            ? {
                frames: parseStackTrace(error.stack),
              }
            : undefined,
        },
      ],
    },
    level: 'error',
    timestamp: Date.now() / 1000,
    platform: 'deno',
    environment: config.environment || 'production',
    tags: {
      runtime: 'edge-function',
      ...context?.tags,
    },
    extra: context?.extra,
    user: context?.user,
    transaction: context?.functionName,
  };

  if (context?.request) {
    event.request = {
      url: context.request.url,
      method: context.request.method,
      headers: Object.fromEntries(
        Array.from(context.request.headers.entries()).filter(
          ([key]) => !key.toLowerCase().includes('authorization')
        )
      ),
    };
  }

  console.log(`[Sentry] Capturing exception: ${error.message}`);
  return sendEvent(config, event);
}

// Capture a message
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
      ...context?.tags,
    },
    extra: context?.extra,
    transaction: context?.functionName,
  };

  console.log(`[Sentry] Capturing message: ${message}`);
  return sendEvent(config, event);
}

// Parse stack trace into Sentry frames format
function parseStackTrace(
  stack: string
): Array<{ filename: string; function: string; lineno: number }> {
  const frames: Array<{ filename: string; function: string; lineno: number }> = [];

  const lines = stack.split('\n');
  for (const line of lines) {
    // Match patterns like "at functionName (filename:line:col)" or "at filename:line:col"
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+)(?::\d+)?\)?/);
    if (match) {
      frames.push({
        function: match[1] || '<anonymous>',
        filename: match[2],
        lineno: parseInt(match[3], 10),
      });
    }
  }

  // Sentry expects frames in reverse order (oldest first)
  return frames.reverse();
}

// Wrapper function to capture errors in edge function handlers
export function withSentry(
  functionName: string,
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (error) {
      // Capture the error
      await captureException(error instanceof Error ? error : new Error(String(error)), {
        functionName,
        request: req,
      });

      // Re-throw to let the function handle the response
      throw error;
    }
  };
}
