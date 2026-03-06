/**
 * Sanitization utilities for input validation.
 * Prevents XSS and script injection by rejecting dangerous characters.
 */

/** Pattern that rejects HTML tags, script injection, and common XSS vectors */
const DANGEROUS_PATTERN = /[<>"'`]|javascript:|vbscript:|data:/i;

/**
 * Checks if a string contains potentially dangerous content (XSS/script injection).
 */
export function hasDangerousContent(str: string): boolean {
  return DANGEROUS_PATTERN.test(str);
}

/**
 * Reusable Zod refinement for safe text (rejects script-like content).
 */
export function safeTextRefine(str: string): boolean {
  return !hasDangerousContent(str);
}

export const SAFE_TEXT_REFINEMENT_MSG = 'Invalid characters detected. Please remove any HTML or script-like content.';
