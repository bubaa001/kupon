/**
 * Typed application errors.
 *
 * API routes never let an unexpected exception leak internals: `handleApiError`
 * maps this class to a stable JSON envelope and logs everything else.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 400,
    code = 'BAD_REQUEST',
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(message, 400, 'BAD_REQUEST', details);

export const unauthorized = (message = 'Please sign in to continue.') =>
  new AppError(message, 401, 'UNAUTHORIZED');

export const forbidden = (message = 'You do not have access to this resource.') =>
  new AppError(message, 403, 'FORBIDDEN');

export const notFound = (message = 'Resource not found.') =>
  new AppError(message, 404, 'NOT_FOUND');

export const conflict = (message: string, details?: unknown) =>
  new AppError(message, 409, 'CONFLICT', details);

export const tooManyRequests = (message: string, retryAfterSeconds = 60) =>
  new AppError(message, 429, 'RATE_LIMITED', { retryAfterSeconds });
