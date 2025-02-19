/** Supported log levels in order of increasing verbosity */
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Universal logging utility that provides consistent, type-safe logging across the application.
 * Supports multiple log levels and structured metadata logging.
 * 
 * Features:
 * - Environment-based log level configuration
 * - Timestamp-based logging
 * - Structured metadata support
 * - Morgan HTTP logging integration
 * 
 * @example
 * ```typescript
 * const logger = new UniversalLogger('info');
 * logger.info('Operation successful', { userId: '123', action: 'login' });
 * ```
 */
class UniversalLogger {
  private logLevel: LogLevel;

  /**
   * Creates a new UniversalLogger instance.
   * @param level - Initial log level. Defaults to 'info' if not specified.
   */
  constructor(level: LogLevel = 'info') {
    // Read log level from environment, falling back to constructor parameter
    const envLevel = (process.env.LOG_LEVEL || '').toLowerCase();
    // Validate and set log level, defaulting to 'error' if invalid
    this.logLevel = this.validateLogLevel(envLevel) ? envLevel as LogLevel : 'error';
  }

  /**
   * Validates if a given string is a valid log level.
   * @param level - The log level string to validate
   * @returns boolean indicating if the level is valid
   */
  private validateLogLevel(level: string): boolean {
    const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    return validLevels.includes(level as LogLevel);
  }

  /**
   * Determines if a message at the given level should be logged based on current log level.
   * Uses numeric values to represent log levels for comparison.
   * @param level - The log level to check
   * @returns boolean indicating if the message should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    // Map log levels to numeric values for comparison
    const logLevels: Record<LogLevel, number> = {
      error: 0, // Most important, always logged
      warn: 1,
      info: 2,
      debug: 3  // Most verbose
    };

    return logLevels[level] <= logLevels[this.logLevel];
  }

  /**
   * Internal logging implementation that handles the actual logging logic.
   * @param level - The log level for this message
   * @param message - The main log message
   * @param meta - Optional structured metadata to include in the log
   */
  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    if (!this.shouldLog(level)) return;

    // Create ISO timestamp for consistent logging
    const timestamp = new Date().toISOString();
    // Format log message with optional metadata
    const logMessage = meta 
      ? `${timestamp} [${level.toUpperCase()}] ${message} ${JSON.stringify(meta)}` 
      : `${timestamp} [${level.toUpperCase()}] ${message}`;

    // Use appropriate console method based on log level
    switch(level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'debug':
        console.debug(logMessage);
        break;
    }
  }

  /**
   * Logs an error message with optional metadata.
   * @param message - The error message to log
   * @param meta - Optional metadata object with additional context
   */
  error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta);
  }

  /**
   * Logs a warning message with optional metadata.
   * @param message - The warning message to log
   * @param meta - Optional metadata object with additional context
   */
  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }

  /**
   * Logs an informational message with optional metadata.
   * @param message - The info message to log
   * @param meta - Optional metadata object with additional context
   */
  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  /**
   * Logs a debug message with optional metadata.
   * @param message - The debug message to log
   * @param meta - Optional metadata object with additional context
   */
  debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }
}

// Create singleton logger instance with default configuration
const logger = new UniversalLogger();

/**
 * Morgan-compatible stream interface for HTTP request logging.
 * Integrates with the UniversalLogger for consistent logging across the application.
 */
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export { logger };
export default logger;
