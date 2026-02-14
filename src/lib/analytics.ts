/**
 * Simple analytics tracking for Shield
 * 
 * This module provides basic event tracking that can be easily 
 * connected to Google Analytics, Mixpanel, Posthog, or any analytics service.
 * 
 * For now, it logs to console and stores events in localStorage for review.
 * When you're ready, replace the implementations with your preferred service.
 */

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: string;
  page: string;
  sessionId: string;
}

// Generate or retrieve session ID
function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  
  let sessionId = sessionStorage.getItem("shield_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem("shield_session_id", sessionId);
  }
  return sessionId;
}

// Get stored events (for debugging/review)
export function getStoredEvents(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  
  try {
    const events = localStorage.getItem("shield_analytics_events");
    return events ? JSON.parse(events) : [];
  } catch {
    return [];
  }
}

// Store event locally (keeps last 100 events)
function storeEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  
  try {
    const events = getStoredEvents();
    events.push(event);
    
    // Keep only last 100 events
    const trimmedEvents = events.slice(-100);
    localStorage.setItem("shield_analytics_events", JSON.stringify(trimmedEvents));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Track a custom event
 * 
 * @example
 * trackEvent("signup_started", { role: "venue" });
 * trackEvent("booking_created", { venue_id: "123", amount: 120 });
 */
export function trackEvent(
  name: string,
  properties?: Record<string, unknown>
): void {
  const event: AnalyticsEvent = {
    name,
    properties,
    timestamp: new Date().toISOString(),
    page: typeof window !== "undefined" ? window.location.pathname : "server",
    sessionId: getSessionId(),
  };

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("📊 Analytics Event:", event);
  }

  // Store locally for debugging
  storeEvent(event);

  // TODO: Send to your analytics service
  // Examples:
  
  // Google Analytics 4
  // if (typeof gtag !== "undefined") {
  //   gtag("event", name, properties);
  // }

  // Mixpanel
  // if (typeof mixpanel !== "undefined") {
  //   mixpanel.track(name, properties);
  // }

  // Posthog
  // if (typeof posthog !== "undefined") {
  //   posthog.capture(name, properties);
  // }

  // Custom API endpoint
  // fetch("/api/analytics", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(event),
  // }).catch(() => {});
}

/**
 * Track a page view
 * 
 * @example
 * trackPageView("home");
 * trackPageView("signup", { step: 1 });
 */
export function trackPageView(
  pageName: string,
  properties?: Record<string, unknown>
): void {
  trackEvent("page_view", {
    page_name: pageName,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    referrer: typeof document !== "undefined" ? document.referrer : undefined,
    ...properties,
  });
}

/**
 * Track when a user starts signup
 */
export function trackSignupStarted(role: "venue" | "personnel" | "agency"): void {
  trackEvent("signup_started", { role });
}

/**
 * Track when a user completes signup
 */
export function trackSignupCompleted(role: "venue" | "personnel" | "agency"): void {
  trackEvent("signup_completed", { role });
}

/**
 * Track when a booking is created
 */
export function trackBookingCreated(data: {
  bookingId: string;
  venueId: string;
  amount: number;
  staffCount: number;
}): void {
  trackEvent("booking_created", data);
}

/**
 * Track when a booking is accepted
 */
export function trackBookingAccepted(data: {
  bookingId: string;
  personnelId?: string;
  agencyId?: string;
}): void {
  trackEvent("booking_accepted", data);
}

/**
 * Track errors for debugging
 */
export function trackError(error: string, context?: Record<string, unknown>): void {
  trackEvent("error", {
    error_message: error,
    ...context,
  });
}

/**
 * Identify a user (call after login/signup)
 */
export function identifyUser(userId: string, traits?: Record<string, unknown>): void {
  trackEvent("user_identified", {
    user_id: userId,
    ...traits,
  });

  // Store user ID for future events
  if (typeof window !== "undefined") {
    localStorage.setItem("shield_user_id", userId);
  }

  // TODO: Send to your analytics service
  // mixpanel.identify(userId);
  // posthog.identify(userId, traits);
}

/**
 * Clear stored analytics data (for testing)
 */
export function clearAnalytics(): void {
  if (typeof window === "undefined") return;
  
  localStorage.removeItem("shield_analytics_events");
  localStorage.removeItem("shield_user_id");
  sessionStorage.removeItem("shield_session_id");
}

// Export a summary function for debugging
export function getAnalyticsSummary(): {
  totalEvents: number;
  eventCounts: Record<string, number>;
  recentEvents: AnalyticsEvent[];
} {
  const events = getStoredEvents();
  
  const eventCounts: Record<string, number> = {};
  events.forEach((e) => {
    eventCounts[e.name] = (eventCounts[e.name] || 0) + 1;
  });

  return {
    totalEvents: events.length,
    eventCounts,
    recentEvents: events.slice(-10),
  };
}
