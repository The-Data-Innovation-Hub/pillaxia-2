/**
 * Shared validation utilities for Azure Functions
 * Ported from Supabase Edge Functions (_shared/validation.ts)
 *
 * Provides Zod-like runtime input validation without external deps.
 */

// ============= Primitive Validators =============

export const validators = {
  /** @returns {{ validate: (value: unknown) => { success: boolean, data?: string, error?: string } }} */
  string(options) {
    return {
      validate(value) {
        if (value === undefined || value === null || value === '') {
          if (options?.required === false) return { success: true, data: '' };
          return { success: false, error: 'String is required' };
        }
        if (typeof value !== 'string') return { success: false, error: 'Expected string' };
        if (options?.minLength && value.length < options.minLength)
          return { success: false, error: `String must be at least ${options.minLength} characters` };
        if (options?.maxLength && value.length > options.maxLength)
          return { success: false, error: `String must not exceed ${options.maxLength} characters` };
        if (options?.pattern && !options.pattern.test(value))
          return { success: false, error: 'String does not match required pattern' };
        return { success: true, data: value };
      },
    };
  },

  email() {
    return {
      validate(value) {
        if (typeof value !== 'string') return { success: false, error: 'Expected email string' };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          return { success: false, error: 'Invalid email format' };
        if (value.length > 254) return { success: false, error: 'Email too long' };
        return { success: true, data: value };
      },
    };
  },

  uuid() {
    return {
      validate(value) {
        if (typeof value !== 'string') return { success: false, error: 'Expected UUID string' };
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
          return { success: false, error: 'Invalid UUID format' };
        return { success: true, data: value };
      },
    };
  },

  number(options) {
    return {
      validate(value) {
        if (value === undefined || value === null) return { success: false, error: 'Number is required' };
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (typeof num !== 'number' || isNaN(num)) return { success: false, error: 'Expected number' };
        if (options?.integer && !Number.isInteger(num))
          return { success: false, error: 'Expected integer' };
        if (options?.min !== undefined && num < options.min)
          return { success: false, error: `Number must be at least ${options.min}` };
        if (options?.max !== undefined && num > options.max)
          return { success: false, error: `Number must not exceed ${options.max}` };
        return { success: true, data: num };
      },
    };
  },

  boolean() {
    return {
      validate(value) {
        if (typeof value === 'boolean') return { success: true, data: value };
        if (value === 'true') return { success: true, data: true };
        if (value === 'false') return { success: true, data: false };
        return { success: false, error: 'Expected boolean' };
      },
    };
  },

  array(itemValidator, options) {
    return {
      validate(value) {
        if (!Array.isArray(value)) return { success: false, error: 'Expected array' };
        if (options?.minLength && value.length < options.minLength)
          return { success: false, error: `Array must have at least ${options.minLength} items` };
        if (options?.maxLength && value.length > options.maxLength)
          return { success: false, error: `Array must not exceed ${options.maxLength} items` };
        const results = [];
        for (let i = 0; i < value.length; i++) {
          const r = itemValidator.validate(value[i]);
          if (!r.success) return { success: false, error: `Item [${i}]: ${r.error}` };
          results.push(r.data);
        }
        return { success: true, data: results };
      },
    };
  },

  optional(validator) {
    return {
      validate(value) {
        if (value === undefined || value === null) return { success: true, data: undefined };
        return validator.validate(value);
      },
    };
  },

  oneOf(values) {
    return {
      validate(value) {
        if (typeof value !== 'string' || !values.includes(value))
          return { success: false, error: `Must be one of: ${values.join(', ')}` };
        return { success: true, data: value };
      },
    };
  },

  /** Alias for oneOf */
  enum(values) {
    return validators.oneOf(values);
  },

  object(schema = {}) {
    return {
      validate(value) {
        if (typeof value !== 'object' || value === null)
          return { success: false, error: 'Expected object' };
        if (Object.keys(schema).length === 0) return { success: true, data: value };
        const result = {};
        const errors = [];
        for (const [key, validator] of Object.entries(schema)) {
          const r = validator.validate(value[key]);
          if (!r.success) errors.push(`${key}: ${r.error}`);
          else result[key] = r.data;
        }
        if (errors.length > 0) return { success: false, error: errors.join('; ') };
        return { success: true, data: result };
      },
    };
  },
};

// ============= Object Schema Validation =============

/**
 * @param {Record<string, { validate: Function }>} schema
 * @param {unknown} data
 */
export function validateSchema(schema, data) {
  if (typeof data !== 'object' || data === null)
    return { success: false, error: 'Expected object' };

  const result = {};
  const errors = {};
  for (const [key, validator] of Object.entries(schema)) {
    const r = validator.validate(data[key]);
    if (!r.success) errors[key] = r.error;
    else result[key] = r.data;
  }
  if (Object.keys(errors).length > 0)
    return { success: false, error: 'Validation failed', details: errors };
  return { success: true, data: result };
}

// ============= Common Schemas =============

export const commonSchemas = {
  userIdPayload: { user_id: validators.uuid() },
  userIdsPayload: {
    user_ids: validators.array(validators.uuid(), { minLength: 1, maxLength: 100 }),
  },
  paginationParams: {
    limit: validators.optional(validators.number({ min: 1, max: 100, integer: true })),
    offset: validators.optional(validators.number({ min: 0, integer: true })),
  },
  pushNotificationPayload: {
    user_ids: validators.array(validators.uuid(), { minLength: 1, maxLength: 100 }),
    payload: validators.optional(validators.object()),
  },
};

// ============= Error Response Helpers =============

/**
 * Build a JSON error body from a failed validation result.
 * Suitable for returning from Azure Function handlers.
 * @param {{ success: false, error: string, details?: Record<string, string> }} result
 * @param {Record<string, string>} corsHeaders
 * @returns {{ status: 400, headers: Record<string, string>, jsonBody: object }}
 */
export function validationErrorResponse(result, corsHeaders) {
  if (result.success) throw new Error('validationErrorResponse called with successful result');
  return {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    jsonBody: { error: result.error, details: result.details },
  };
}
