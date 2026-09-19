import type { DomainError } from './domain-error'

interface HttpError {
  statusCode: number
  error: string
  message: string
}

const HTTP_STATUS_MAP: Record<string, number> = {
  NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  ORDER_NOT_FOUND: 404,
  DUPLICATE_ORDER: 409,
  VALIDATION_ERROR: 422,
  ERP_UNAVAILABLE: 503,
}

export function toHttpError(error: DomainError): HttpError {
  const statusCode = HTTP_STATUS_MAP[error.code] ?? 500
  return {
    statusCode,
    error: error.code,
    message: error.message,
  }
}
