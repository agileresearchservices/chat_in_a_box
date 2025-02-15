type LogLevel = 'error' | 'warn' | 'info' | 'debug';

class UniversalLogger {
  private logLevel: LogLevel;

  constructor(level: LogLevel = 'info') {
    // Validate and set log level, defaulting to 'error' if invalid
    const envLevel = (process.env.LOG_LEVEL || '').toLowerCase();
    this.logLevel = this.validateLogLevel(envLevel) ? envLevel as LogLevel : 'error';
  }

  private validateLogLevel(level: string): boolean {
    const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    return validLevels.includes(level as LogLevel);
  }

  private shouldLog(level: LogLevel): boolean {
    const logLevels: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    return logLevels[level] <= logLevels[this.logLevel];
  }

  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logMessage = meta 
      ? `${timestamp} [${level.toUpperCase()}] ${message} ${JSON.stringify(meta)}` 
      : `${timestamp} [${level.toUpperCase()}] ${message}`;

    // Use console methods for logging
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

  error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta);
  }
}

// Create a logger instance with configurable log level from environment
const logger = new UniversalLogger();

// Create a stream object for Morgan HTTP logging
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export { logger };
export default logger;
