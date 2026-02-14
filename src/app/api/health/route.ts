import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/ratelimit';

/**
 * Health check endpoint with rate limiting example
 * GET /api/health
 */
export async function GET(req: NextRequest) {
  // Apply rate limiting
  const { success, response, result } = await withRateLimit(req, 'api');
  
  if (!success && response) {
    return response;
  }

  // Health check response
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    rateLimit: {
      remaining: result.remaining,
      limit: result.limit,
    },
  };

  return NextResponse.json(healthData, {
    headers: {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toString(),
    },
  });
}
