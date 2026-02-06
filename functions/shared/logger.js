/**
 * Structured JSON logger for Azure Functions.
 *
 * Azure Functions captures stdout as structured logs, so we write JSON
 * lines to ensure consistent format with function name, invocation ID,
 * severity, and structured data.
 *
 * Usage:
 *   const log = createFunctionLogger('my-function-name', context);
 *   log.info('Starting', { count: 5 });
 *   log.warn('Slow query', { durationMs: 1200 });
 *   log.error('Failed', { err: e });
 */

function createFunctionLogger(functionName, context) {
  const invocationId = context?.invocationId || 'unknown';

  function emit(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      functionName,
      invocationId,
      message,
      ...data,
    };
    // Also forward to Azure Functions runtime logger for portal visibility
    const line = JSON.stringify(entry);
    if (level === 'error') {
      if (context?.error) context.error(line);
      else process.stderr.write(line + '\n');
    } else if (level === 'warn') {
      if (context?.warn) context.warn(line);
      else process.stdout.write(line + '\n');
    } else {
      if (context?.log) context.log(line);
      else process.stdout.write(line + '\n');
    }
  }

  return {
    info: (msg, data) => emit('info', msg, data),
    warn: (msg, data) => emit('warn', msg, data),
    error: (msg, data) => emit('error', msg, data),
    debug: (msg, data) => emit('debug', msg, data),
  };
}

export { createFunctionLogger };
