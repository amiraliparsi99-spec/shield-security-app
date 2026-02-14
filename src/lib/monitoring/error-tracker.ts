/**
 * Error Tracking & Monitoring System
 * Captures, logs, and reports errors across the application
 * 
 * Can be integrated with external services like Sentry, LogRocket, etc.
 * Currently logs to console and stores in Supabase for basic tracking
 */

import { createClient } from '@/lib/supabase/client';

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error categories
export type ErrorCategory = 
  | 'auth'
  | 'database'
  | 'api'
  | 'payment'
  | 'booking'
  | 'notification'
  | 'file_upload'
  | 'validation'
  | 'unknown';

export interface ErrorContext {
  userId?: string;
  userRole?: string;
  route?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export interface TrackedError {
  id?: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  timestamp: string;
  resolved: boolean;
  environment: string;
}

// In-memory error buffer for batching
const errorBuffer: TrackedError[] = [];
const BUFFER_FLUSH_INTERVAL = 10000; // 10 seconds
const MAX_BUFFER_SIZE = 50;

// Initialize periodic flush
if (typeof window !== 'undefined') {
  setInterval(flushErrorBuffer, BUFFER_FLUSH_INTERVAL);
}

/**
 * Track an error
 */
export async function trackError(
  error: Error | string,
  options: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    context?: ErrorContext;
    silent?: boolean;
  } = {}
): Promise<void> {
  const {
    severity = 'medium',
    category = 'unknown',
    context = {},
    silent = false,
  } = options;

  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  const trackedError: TrackedError = {
    message: errorMessage,
    stack: errorStack,
    severity,
    category,
    context: {
      ...context,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    },
    timestamp: new Date().toISOString(),
    resolved: false,
    environment: process.env.NODE_ENV || 'development',
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development' && !silent) {
    console.error(`[${severity.toUpperCase()}] [${category}]`, errorMessage, context);
    if (errorStack) console.error(errorStack);
  }

  // Add to buffer
  errorBuffer.push(trackedError);

  // Flush if buffer is full
  if (errorBuffer.length >= MAX_BUFFER_SIZE) {
    await flushErrorBuffer();
  }

  // Immediately report critical errors
  if (severity === 'critical') {
    await reportCriticalError(trackedError);
  }
}

/**
 * Flush error buffer to storage
 */
async function flushErrorBuffer(): Promise<void> {
  if (errorBuffer.length === 0) return;

  const errorsToFlush = [...errorBuffer];
  errorBuffer.length = 0;

  try {
    const supabase = createClient();
    
    // Store errors in database
    const { error } = await supabase
      .from('error_logs')
      .insert(errorsToFlush.map(e => ({
        message: e.message,
        stack: e.stack,
        severity: e.severity,
        category: e.category,
        context: e.context,
        environment: e.environment,
        resolved: false,
      })));

    if (error) {
      // If DB insert fails, log to console as fallback
      console.error('[ErrorTracker] Failed to flush errors to database:', error);
      errorsToFlush.forEach(e => {
        console.error('[Buffered Error]', e);
      });
    }
  } catch (err) {
    console.error('[ErrorTracker] Exception during flush:', err);
  }
}

/**
 * Report critical errors immediately
 */
async function reportCriticalError(error: TrackedError): Promise<void> {
  // In production, you might want to:
  // 1. Send to Slack/Discord webhook
  // 2. Send to PagerDuty
  // 3. Send email alert
  
  console.error('[CRITICAL ERROR]', error);

  // Example: Send to a webhook (uncomment and configure)
  // try {
  //   await fetch(process.env.ALERT_WEBHOOK_URL!, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({
  //       text: `🚨 Critical Error in Shield\n\nMessage: ${error.message}\nCategory: ${error.category}\nRoute: ${error.context.route}`,
  //     }),
  //   });
  // } catch (e) {
  //   console.error('[ErrorTracker] Failed to send critical alert:', e);
  // }
}

/**
 * Create a scoped error tracker for a specific feature
 */
export function createErrorTracker(defaultCategory: ErrorCategory, defaultContext: ErrorContext = {}) {
  return {
    track: (
      error: Error | string,
      options: Omit<Parameters<typeof trackError>[1], 'category'> & { category?: ErrorCategory } = {}
    ) => trackError(error, {
      ...options,
      category: options.category || defaultCategory,
      context: { ...defaultContext, ...options.context },
    }),
    
    low: (error: Error | string, context?: ErrorContext) => 
      trackError(error, { severity: 'low', category: defaultCategory, context: { ...defaultContext, ...context } }),
    
    medium: (error: Error | string, context?: ErrorContext) => 
      trackError(error, { severity: 'medium', category: defaultCategory, context: { ...defaultContext, ...context } }),
    
    high: (error: Error | string, context?: ErrorContext) => 
      trackError(error, { severity: 'high', category: defaultCategory, context: { ...defaultContext, ...context } }),
    
    critical: (error: Error | string, context?: ErrorContext) => 
      trackError(error, { severity: 'critical', category: defaultCategory, context: { ...defaultContext, ...context } }),
  };
}

/**
 * Wrap an async function with error tracking
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    category?: ErrorCategory;
    action?: string;
    rethrow?: boolean;
  } = {}
): T {
  const { category = 'unknown', action, rethrow = true } = options;

  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      await trackError(error as Error, {
        category,
        context: { action },
        severity: 'high',
      });
      
      if (rethrow) throw error;
      return undefined;
    }
  }) as T;
}

// Pre-configured trackers for common use cases
export const authErrorTracker = createErrorTracker('auth');
export const apiErrorTracker = createErrorTracker('api');
export const paymentErrorTracker = createErrorTracker('payment');
export const bookingErrorTracker = createErrorTracker('booking');
