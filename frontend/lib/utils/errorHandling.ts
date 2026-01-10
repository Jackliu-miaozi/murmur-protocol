export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function handleError(error: unknown): string {
  if (error instanceof AppError) {
    return error.message
  }

  if (error instanceof Error) {
    // Parse common error patterns
    const message = error.message.toLowerCase()

    if (message.includes('user rejected')) {
      return 'Transaction was rejected by user'
    }

    if (message.includes('insufficient')) {
      return 'Insufficient balance to complete transaction'
    }

    if (message.includes('not connected')) {
      return 'Please connect your wallet first'
    }

    if (message.includes('network')) {
      return 'Network error. Please check your connection'
    }

    return error.message
  }

  return 'An unknown error occurred'
}

export function logError(error: unknown, context?: string) {
  console.error(
    `[Error${context ? ` - ${context}` : ''}]:`,
    error instanceof Error ? error.message : error,
    error instanceof Error ? error.stack : ''
  )
}
