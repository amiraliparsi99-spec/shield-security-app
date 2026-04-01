/**
 * Shared error handling for mobile: normalize errors and return user-friendly messages.
 */

export interface NormalizedError {
  message: string;
  code?: string;
  userMessage: string;
}

export function normalizeError(error: unknown): NormalizedError {
  if (error == null) {
    return { message: "Unknown error", userMessage: "Something went wrong. Please try again." };
  }
  if (typeof error === "string") {
    return { message: error, userMessage: error };
  }
  if (error instanceof Error) {
    const message = error.message || "Unknown error";
    return {
      message,
      userMessage: toUserMessage(message, (error as { code?: string }).code),
    };
  }
  if (typeof error === "object" && "message" in error) {
    const msg = String((error as { message: unknown }).message);
    const code = "code" in error ? String((error as { code: unknown }).code) : undefined;
    return {
      message: msg,
      code,
      userMessage: toUserMessage(msg, code),
    };
  }
  return { message: "Unknown error", userMessage: "Something went wrong. Please try again." };
}

function toUserMessage(message: string, code?: string): string {
  if (code === "23505") {
    return "This record already exists. You may have already submitted this.";
  }
  if (code === "23502") {
    return "Missing required information. Please check the form and try again.";
  }
  if (code === "23503") {
    return "A related record was not found. Please refresh and try again.";
  }
  if (message.includes("Row Level Security") || message.includes("RLS")) {
    return "You don't have permission to perform this action.";
  }
  if (message.includes("JWT") || message.includes("auth")) {
    return "Your session may have expired. Please sign in again.";
  }
  if (message.length > 120) {
    return "Something went wrong. Please try again.";
  }
  return message;
}

export function getUserMessage(error: unknown): string {
  return normalizeError(error).userMessage;
}
