/**
 * Rate Limiting System
 * Protects API routes from abuse using Upstash Redis
 * Falls back to in-memory limiting if Redis is not configured
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// Check if Upstash is properly configured (not placeholder values)
const UPSTASH_CONFIGURED = !!(
  process.env.UPSTASH_REDIS_REST_URL && 
  process.env.UPSTASH_REDIS_REST_TOKEN &&
  !process.env.UPSTASH_REDIS_REST_URL.includes('YOUR_') &&
  !process.env.UPSTASH_REDIS_REST_URL.includes('your_') &&
  process.env.UPSTASH_REDIS_REST_URL.startsWith('https://')
);

// Initialize Redis client if configured
const redis = UPSTASH_CONFIGURED
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Log rate limiting mode on startup
if (typeof window === 'undefined') {
  console.log(`[RateLimit] Using ${UPSTASH_CONFIGURED ? 'Upstash Redis' : 'in-memory'} rate limiting`);
}

// =====================================================
// RATE LIMIT CONFIGURATIONS
// =====================================================

export type RateLimitType = 
  | 'api'           // General API calls
  | 'auth'          // Auth endpoints (login, signup)
  | 'sensitive'     // Sensitive operations (password reset)
  | 'upload'        // File uploads
  | 'search'        // Search/query endpoints
  | 'messaging'     // Messages/notifications
  | 'booking';      // Booking operations

const RATE_LIMITS: Record<RateLimitType, { requests: number; window: string }> = {
  api: { requests: 100, window: '1 m' },        // 100 requests per minute
  auth: { requests: 10, window: '1 m' },        // 10 auth attempts per minute
  sensitive: { requests: 5, window: '15 m' },   // 5 sensitive ops per 15 min
  upload: { requests: 20, window: '1 h' },      // 20 uploads per hour
  search: { requests: 60, window: '1 m' },      // 60 searches per minute
  messaging: { requests: 50, window: '1 m' },   // 50 messages per minute
  booking: { requests: 30, window: '1 m' },     // 30 booking ops per minute
};

// Create rate limiters for each type
const rateLimiters: Partial<Record<RateLimitType, Ratelimit>> = {};

if (redis) {
  Object.entries(RATE_LIMITS).forEach(([type, config]) => {
    rateLimiters[type as RateLimitType] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      analytics: true,
      prefix: `shield:ratelimit:${type}`,
    });
  });
}

// =====================================================
// IN-MEMORY FALLBACK
// =====================================================

interface InMemoryEntry {
  count: number;
  resetAt: number;
}

const inMemoryStore = new Map<string, InMemoryEntry>();

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) return 60000; // Default 1 minute

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return 60000;
  }
}

async function inMemoryRateLimit(
  identifier: string,
  type: RateLimitType
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const config = RATE_LIMITS[type];
  const key = `${type}:${identifier}`;
  const now = Date.now();
  const windowMs = parseWindow(config.window);

  let entry = inMemoryStore.get(key);

  // Clean up or create new entry
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    inMemoryStore.set(key, entry);
  }

  entry.count++;

  const success = entry.count <= config.requests;
  const remaining = Math.max(0, config.requests - entry.count);
  const reset = entry.resetAt;

  return { success, remaining, reset };
}

// Periodic cleanup of in-memory store
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of inMemoryStore.entries()) {
      if (now > entry.resetAt) {
        inMemoryStore.delete(key);
      }
    }
  }, 60000); // Clean up every minute
}

// =====================================================
// MAIN RATE LIMIT FUNCTION
// =====================================================

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

/**
 * Check rate limit for an identifier
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'api'
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[type];

  if (redis && rateLimiters[type]) {
    const result = await rateLimiters[type]!.limit(identifier);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
      limit: config.requests,
    };
  }

  // Fallback to in-memory
  const result = await inMemoryRateLimit(identifier, type);
  return {
    ...result,
    limit: config.requests,
  };
}

/**
 * Get identifier from request (IP or user ID)
 */
export function getIdentifier(req: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`;
  
  // Try to get real IP from various headers
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfIp = req.headers.get('cf-connecting-ip');
  
  const ip = cfIp || realIp || forwarded?.split(',')[0] || 'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limit response headers
 */
export function rateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', result.reset.toString());
  return headers;
}

/**
 * Rate limited response
 */
export function rateLimitedResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests',
      message: 'Please slow down and try again later',
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: rateLimitHeaders(result),
    }
  );
}

// =====================================================
// MIDDLEWARE HELPER
// =====================================================

/**
 * Rate limit middleware for API routes
 */
export async function withRateLimit(
  req: NextRequest,
  type: RateLimitType = 'api',
  userId?: string
): Promise<{ success: boolean; response?: NextResponse; result: RateLimitResult }> {
  const identifier = getIdentifier(req, userId);
  const result = await checkRateLimit(identifier, type);

  if (!result.success) {
    return {
      success: false,
      response: rateLimitedResponse(result),
      result,
    };
  }

  return { success: true, result };
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 */
export function createRateLimitedHandler<T extends (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>>(
  handler: T,
  type: RateLimitType = 'api'
): T {
  return (async (req: NextRequest, ...args: unknown[]) => {
    const { success, response, result } = await withRateLimit(req, type);

    if (!success && response) {
      return response;
    }

    // Add rate limit headers to successful response
    const handlerResponse = await handler(req, ...args);
    const headers = rateLimitHeaders(result);
    
    headers.forEach((value, key) => {
      handlerResponse.headers.set(key, value);
    });

    return handlerResponse;
  }) as T;
}
