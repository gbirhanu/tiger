// Basic logger implementation with different log levels
export const logger = {
  debug: (message: string, meta?: Record<string, any>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] ${message}`, meta || '');
    }
  },
  info: (message: string, meta?: Record<string, any>) => {
    console.log(`[INFO] ${message}`, meta || '');
  },
  warn: (message: string, meta?: Record<string, any>) => {
    console.warn(`[WARN] ${message}`, meta || '');
  },
  error: (message: string, meta?: Record<string, any>) => {
    console.error(`[ERROR] ${message}`, meta || '');
  }
};

