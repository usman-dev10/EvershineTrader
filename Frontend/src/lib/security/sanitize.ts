/** Strip control characters and trim user-facing strings. */
export function sanitizeText(input: string, maxLength = 500): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

/** Map backend errors to safe display copy (never echo raw server stacks). */
export function safeErrorMessage(
  code: string | undefined,
  fallback = "Something went wrong. Please try again.",
): string {
  const map: Record<string, string> = {
    INVALID_CREDENTIALS: "Incorrect email or password.",
    ACCOUNT_INACTIVE:
      "Your account has been disabled. Contact your company administrator.",
    UNAUTHORIZED: "You don't have permission to view this page.",
    NO_OPEN_SHIFT:
      "No shift is currently open. Please open a shift to continue.",
    SHIFT_ALREADY_OPEN: "A shift is currently open. Close it before opening a new one.",
    SHIFT_CLOSED: "This shift is closed. New records cannot be added.",
    SHEET_LIMIT_EXCEEDED: "Cannot add this pile. Not enough sheets remain for this job.",
    WORKER_NOT_ON_DUTY: "This worker is not on duty for the current shift.",
    DUPLICATE_JOB_NUMBER: "A job with this number already exists.",
    VALIDATION_ERROR: "Please complete all required fields.",
  };

  if (!code) return fallback;
  return map[code] ?? fallback;
}
