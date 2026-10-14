/**
 * Safe AI Observability and Telemetry Helper
 * 
 * Strict Redaction Guarantees:
 * - NEVER logs GEMINI_API_KEY, headers, or credentials.
 * - NEVER logs customer prompt content, edit instructions, or attached image base64 data.
 * - NEVER logs generated source code (HTML, CSS, JS).
 * - Logs only token counts, latencies, model versions, status codes, and failure categories.
 */

export interface AITelemetryPayload {
  timestamp: string;
  operation:
    | "generate_website"
    | "edit_website"
    | "seo_suggestions"
    | "seo_agent"
    | "content_studio"
    | "blog_generate"
    | "assistant_chat"
    | "transcribe"
    | "google_strategy"
    | "campaign_planner"
    | "performance_analyzer"
    | "unified_core"
    | "context_orchestrator"
    | "redesign_engine";
  requestedModel: string;
  servedModel?: string;
  status: "SUCCESS" | "FAILED";
  statusCode: number;
  failureCategory?:
    | "CAPACITY_503"
    | "RATE_LIMIT_429"
    | "TIMEOUT"
    | "AUTH_ERROR"
    | "INVALID_ARGUMENT"
    | "INTERNAL_ERROR"
    | "EMPTY_RESPONSE";
  latencyMs: number;
  attempt?: number;
  fallbackIndex?: number;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  promptLengthChars?: number;
  responseLengthChars?: number;
  hasImages?: boolean;
}

export function logAITelemetry(payload: AITelemetryPayload): void {
  try {
    const sanitized = {
      event: "AI_TELEMETRY",
      timestamp: payload.timestamp || new Date().toISOString(),
      operation: payload.operation,
      requestedModel: payload.requestedModel,
      servedModel: payload.servedModel || payload.requestedModel,
      status: payload.status,
      statusCode: payload.statusCode,
      failureCategory: payload.failureCategory || undefined,
      latencyMs: Math.round(payload.latencyMs),
      attempt: payload.attempt ?? 1,
      fallbackIndex: payload.fallbackIndex ?? 0,
      promptTokenCount: payload.promptTokenCount ?? 0,
      candidatesTokenCount: payload.candidatesTokenCount ?? 0,
      totalTokenCount: payload.totalTokenCount ?? 0,
      promptLengthChars: payload.promptLengthChars ?? 0,
      responseLengthChars: payload.responseLengthChars ?? 0,
      hasImages: Boolean(payload.hasImages),
    };

    console.log(`[AI_TELEMETRY] ${JSON.stringify(sanitized)}`);
  } catch {
    // Fail-safe: telemetry logging must never throw or disrupt execution
  }
}

export interface ClassifiedGeminiError {
  statusCode: number;
  failureCategory:
    | "CAPACITY_503"
    | "RATE_LIMIT_429"
    | "TIMEOUT"
    | "AUTH_ERROR"
    | "INVALID_ARGUMENT"
    | "INTERNAL_ERROR"
    | "EMPTY_RESPONSE";
  isCapacityOrRateLimit: boolean;
  isTransient: boolean;
  isAuthError: boolean;
  sanitizedMessage: string;
}

export function classifyGeminiError(error: unknown): ClassifiedGeminiError {
  const errObj = error as { name?: string; message?: string; status?: number; statusCode?: number } | null | undefined;
  const errMsg = errObj?.message || String(error || "");
  const rawStatus = errObj?.status || errObj?.statusCode;

  if (
    errMsg.includes("503") ||
    errMsg.includes("UNAVAILABLE") ||
    errMsg.includes("high demand") ||
    errMsg.includes("overloaded") ||
    rawStatus === 503
  ) {
    return {
      statusCode: 503,
      failureCategory: "CAPACITY_503",
      isCapacityOrRateLimit: true,
      isTransient: true,
      isAuthError: false,
      sanitizedMessage:
        "The AI engine is currently experiencing high demand. Please wait a moment and try again.",
    };
  }

  if (
    errMsg.includes("429") ||
    errMsg.includes("RESOURCE_EXHAUSTED") ||
    errMsg.includes("Quota") ||
    errMsg.includes("rate limit") ||
    rawStatus === 429
  ) {
    return {
      statusCode: 429,
      failureCategory: "RATE_LIMIT_429",
      isCapacityOrRateLimit: true,
      isTransient: true,
      isAuthError: false,
      sanitizedMessage:
        "AI Engine rate limit exceeded. Please wait a moment and try again.",
    };
  }

  if (
    errObj?.name === "AbortError" ||
    errMsg.includes("aborted") ||
    errMsg.includes("timeout") ||
    errMsg.includes("timed out") ||
    errMsg.includes("ETIMEDOUT") ||
    errMsg.includes("ECONNRESET") ||
    rawStatus === 504
  ) {
    return {
      statusCode: 504,
      failureCategory: "TIMEOUT",
      isCapacityOrRateLimit: false,
      isTransient: true,
      isAuthError: false,
      sanitizedMessage:
        "AI Engine request timed out. Please wait a moment and try again.",
    };
  }

  if (
    errMsg.includes("API key") ||
    errMsg.includes("UNAUTHENTICATED") ||
    errMsg.includes("401") ||
    errMsg.includes("403") ||
    errMsg.includes("PERMISSION_DENIED") ||
    rawStatus === 401 ||
    rawStatus === 403
  ) {
    return {
      statusCode: 401,
      failureCategory: "AUTH_ERROR",
      isCapacityOrRateLimit: false,
      isTransient: false,
      isAuthError: true,
      sanitizedMessage:
        "AI Engine authentication error. Please verify your GEMINI_API_KEY configuration.",
    };
  }

  if (errMsg.includes("INVALID_ARGUMENT") || rawStatus === 400) {
    return {
      statusCode: 400,
      failureCategory: "INVALID_ARGUMENT",
      isCapacityOrRateLimit: false,
      isTransient: false,
      isAuthError: false,
      sanitizedMessage: "Invalid argument supplied to AI Engine.",
    };
  }

  return {
    statusCode: 500,
    failureCategory: "INTERNAL_ERROR",
    isCapacityOrRateLimit: false,
    isTransient: false,
    isAuthError: false,
    sanitizedMessage: "An unexpected error occurred during AI processing.",
  };
}

/**
 * Calculates exponential backoff with full randomized jitter.
 */
export function calculateBackoffWithJitter(
  attempt: number,
  baseMs = 800,
  maxMs = 2500
): number {
  const exponential = Math.min(baseMs * Math.pow(1.5, attempt - 1), maxMs);
  const jitter = Math.floor(Math.random() * 400);
  return exponential + jitter;
}

/**
 * Wraps an async operation with a strict timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = "AI Engine request timed out."
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(errorMessage) as Error & { status?: number };
      err.name = "AbortError";
      err.status = 504;
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
