/**
 * Resolves show-results flags from stored test config, including legacy single-flag JSON
 * where `showResultsImmediately` controlled both per-question feedback and final score visibility.
 */
export function getEffectiveShowResultsFlags(config: unknown): {
  showResultsPerQuestion: boolean;
  showResultsImmediately: boolean;
} {
  const c = config && typeof config === 'object' ? (config as Record<string, unknown>) : {};
  const legacy = c.showResultsImmediately;
  const per = c.showResultsPerQuestion;
  const im = c.showResultsImmediately;
  if (per === undefined && legacy !== undefined) {
    const v = Boolean(legacy);
    return { showResultsPerQuestion: v, showResultsImmediately: v };
  }
  return {
    showResultsPerQuestion: per !== false,
    showResultsImmediately: im !== false,
  };
}
