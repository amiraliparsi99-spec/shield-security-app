/**
 * Performance Monitoring Utilities
 * Track and report performance metrics
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const metrics: PerformanceMetric[] = [];
const MAX_METRICS = 100;

/**
 * Measure execution time of an async function
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();
  
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    recordMetric(name, duration, metadata);
  }
}

/**
 * Measure execution time of a sync function
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, unknown>
): T {
  const start = performance.now();
  
  try {
    return fn();
  } finally {
    const duration = performance.now() - start;
    recordMetric(name, duration, metadata);
  }
}

/**
 * Record a performance metric
 */
function recordMetric(name: string, duration: number, metadata?: Record<string, unknown>): void {
  const metric: PerformanceMetric = {
    name,
    duration,
    timestamp: new Date().toISOString(),
    metadata,
  };

  metrics.push(metric);

  // Keep buffer size manageable
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }

  // Log slow operations in development
  if (process.env.NODE_ENV === 'development' && duration > 1000) {
    console.warn(`[Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
  }
}

/**
 * Get recent metrics
 */
export function getMetrics(filter?: { name?: string; minDuration?: number }): PerformanceMetric[] {
  let result = [...metrics];

  if (filter?.name) {
    result = result.filter(m => m.name.includes(filter.name!));
  }

  if (filter?.minDuration) {
    result = result.filter(m => m.duration >= filter.minDuration!);
  }

  return result;
}

/**
 * Get average duration for a metric
 */
export function getAverageDuration(name: string): number | null {
  const relevantMetrics = metrics.filter(m => m.name === name);
  
  if (relevantMetrics.length === 0) return null;
  
  const total = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
  return total / relevantMetrics.length;
}

/**
 * Create a performance timer
 */
export function createTimer(name: string, metadata?: Record<string, unknown>) {
  const start = performance.now();

  return {
    stop: () => {
      const duration = performance.now() - start;
      recordMetric(name, duration, metadata);
      return duration;
    },
  };
}

/**
 * Web Vitals tracking (for browser)
 */
export function trackWebVitals(): void {
  if (typeof window === 'undefined') return;

  // Largest Contentful Paint
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    recordMetric('web-vital:LCP', lastEntry.startTime);
  });
  
  try {
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    // Observer not supported
  }

  // First Input Delay
  const fidObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      if ('processingStart' in entry) {
        const fid = (entry as PerformanceEventTiming).processingStart - entry.startTime;
        recordMetric('web-vital:FID', fid);
      }
    });
  });

  try {
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch (e) {
    // Observer not supported
  }

  // Cumulative Layout Shift
  let clsValue = 0;
  const clsObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach((entry) => {
      if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) {
        clsValue += (entry as PerformanceEntry & { value: number }).value;
      }
    });
    recordMetric('web-vital:CLS', clsValue);
  });

  try {
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    // Observer not supported
  }
}
