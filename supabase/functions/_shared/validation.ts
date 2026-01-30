/**
 * Shared validation utilities for Edge Functions
 * Uses Zod-like patterns for runtime input validation
 */

// ============= Core Validation Types =============

export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, string> };

export interface FieldValidator<T> {
  validate: (value: unknown) => ValidationResult<T>;
}

// ============= Primitive Validators =============

export const validators = {
  string: (options?: { minLength?: number; maxLength?: number; pattern?: RegExp; required?: boolean }): FieldValidator<string> => ({
    validate: (value) => {
      if (value === undefined || value === null || value === "") {
        if (options?.required === false) {
          return { success: true, data: "" };
        }
        return { success: false, error: "String is required" };
      }
      if (typeof value !== "string") {
        return { success: false, error: "Expected string" };
      }
      if (options?.minLength && value.length < options.minLength) {
        return { success: false, error: `String must be at least ${options.minLength} characters` };
      }
      if (options?.maxLength && value.length > options.maxLength) {
        return { success: false, error: `String must not exceed ${options.maxLength} characters` };
      }
      if (options?.pattern && !options.pattern.test(value)) {
        return { success: false, error: "String does not match required pattern" };
      }
      return { success: true, data: value };
    },
  }),

  email: (): FieldValidator<string> => ({
    validate: (value) => {
      if (typeof value !== "string") {
        return { success: false, error: "Expected email string" };
      }
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return { success: false, error: "Invalid email format" };
      }
      if (value.length > 254) {
        return { success: false, error: "Email too long" };
      }
      return { success: true, data: value };
    },
  }),

  uuid: (): FieldValidator<string> => ({
    validate: (value) => {
      if (typeof value !== "string") {
        return { success: false, error: "Expected UUID string" };
      }
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(value)) {
        return { success: false, error: "Invalid UUID format" };
      }
      return { success: true, data: value };
    },
  }),

  number: (options?: { min?: number; max?: number; integer?: boolean }): FieldValidator<number> => ({
    validate: (value) => {
      if (value === undefined || value === null) {
        return { success: false, error: "Number is required" };
      }
      const num = typeof value === "string" ? parseFloat(value) : value;
      if (typeof num !== "number" || isNaN(num)) {
        return { success: false, error: "Expected number" };
      }
      if (options?.integer && !Number.isInteger(num)) {
        return { success: false, error: "Expected integer" };
      }
      if (options?.min !== undefined && num < options.min) {
        return { success: false, error: `Number must be at least ${options.min}` };
      }
      if (options?.max !== undefined && num > options.max) {
        return { success: false, error: `Number must not exceed ${options.max}` };
      }
      return { success: true, data: num };
    },
  }),

  boolean: (): FieldValidator<boolean> => ({
    validate: (value) => {
      if (typeof value === "boolean") {
        return { success: true, data: value };
      }
      if (value === "true") return { success: true, data: true };
      if (value === "false") return { success: true, data: false };
      return { success: false, error: "Expected boolean" };
    },
  }),

  array: <T>(itemValidator: FieldValidator<T>, options?: { minLength?: number; maxLength?: number }): FieldValidator<T[]> => ({
    validate: (value) => {
      if (!Array.isArray(value)) {
        return { success: false, error: "Expected array" };
      }
      if (options?.minLength && value.length < options.minLength) {
        return { success: false, error: `Array must have at least ${options.minLength} items` };
      }
      if (options?.maxLength && value.length > options.maxLength) {
        return { success: false, error: `Array must not exceed ${options.maxLength} items` };
      }
      const results: T[] = [];
      for (let i = 0; i < value.length; i++) {
        const itemResult = itemValidator.validate(value[i]);
        if (!itemResult.success) {
          return { success: false, error: `Item [${i}]: ${itemResult.error}` };
        }
        results.push(itemResult.data);
      }
      return { success: true, data: results };
    },
  }),

  optional: <T>(validator: FieldValidator<T>): FieldValidator<T | undefined> => ({
    validate: (value) => {
      if (value === undefined || value === null) {
        return { success: true, data: undefined };
      }
      return validator.validate(value);
    },
  }),

  oneOf: <T extends string>(values: readonly T[]): FieldValidator<T> => ({
    validate: (value) => {
      if (typeof value !== "string" || !values.includes(value as T)) {
        return { success: false, error: `Must be one of: ${values.join(", ")}` };
      }
      return { success: true, data: value as T };
    },
  }),
};

// ============= Object Schema Validation =============

type SchemaDefinition = Record<string, FieldValidator<unknown>>;
type InferSchema<T extends SchemaDefinition> = {
  [K in keyof T]: T[K] extends FieldValidator<infer U> ? U : never;
};

export function validateSchema<T extends SchemaDefinition>(
  schema: T,
  data: unknown
): ValidationResult<InferSchema<T>> {
  if (typeof data !== "object" || data === null) {
    return { success: false, error: "Expected object" };
  }

  const result: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const [key, validator] of Object.entries(schema)) {
    const fieldResult = validator.validate((data as Record<string, unknown>)[key]);
    if (!fieldResult.success) {
      errors[key] = fieldResult.error;
    } else {
      result[key] = fieldResult.data;
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      error: "Validation failed",
      details: errors,
    };
  }

  return { success: true, data: result as InferSchema<T> };
}

// ============= Common Schemas =============

export const commonSchemas = {
  userIdPayload: {
    user_id: validators.uuid(),
  },

  userIdsPayload: {
    user_ids: validators.array(validators.uuid(), { minLength: 1, maxLength: 100 }),
  },

  paginationParams: {
    limit: validators.optional(validators.number({ min: 1, max: 100, integer: true })),
    offset: validators.optional(validators.number({ min: 0, integer: true })),
  },

  pushNotificationPayload: {
    user_ids: validators.array(validators.uuid(), { minLength: 1, maxLength: 100 }),
    payload: validators.optional({
      validate: (value) => {
        if (typeof value !== "object" || value === null) {
          return { success: false, error: "Expected payload object" };
        }
        return { success: true, data: value as Record<string, unknown> };
      },
    }),
  },
};

// ============= Error Response Helper =============

export function validationErrorResponse(
  result: ValidationResult<unknown>,
  corsHeaders: Record<string, string>
): Response {
  if (result.success) {
    throw new Error("validationErrorResponse called with successful result");
  }

  return new Response(
    JSON.stringify({
      error: result.error,
      details: result.details,
    }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
