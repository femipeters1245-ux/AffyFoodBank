// backend/src/utils/errors.ts

/**
 * Base class for all operational (expected) API errors.
 * Setting `isOperational = true` tells the central error handler
 * to forward the message to the client instead of sending a generic 500.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    if (code) this.code = code;
    // Maintains proper stack trace (V8 only)
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad Request', code?: string) {
    super(message, 400, code ?? 'BAD_REQUEST');
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', code?: string) {
    super(message, 401, code ?? 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code?: string) {
    super(message, 403, code ?? 'FORBIDDEN');
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not Found', code?: string) {
    super(message, 404, code ?? 'NOT_FOUND');
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict', code?: string) {
    super(message, 409, code ?? 'CONFLICT');
  }
}

export class UnprocessableEntityError extends ApiError {
  constructor(message = 'Unprocessable Entity', code?: string) {
    super(message, 422, code ?? 'UNPROCESSABLE_ENTITY');
  }
}
