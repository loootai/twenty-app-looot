export type ClickResult = {
  outcome: 'updated' | 'skipped' | 'not_found' | 'error';
  message: string;
  run: { costUsd: number } | null;
};

export type ClickSummary = { message: string; variant: 'success' | 'info' | 'error' };

/** Turns the per-record answers of one click into the line shown in the snackbar. */
export const summarizeResults = (results: ClickResult[], selectedCount: number): ClickSummary => {
  if (results.length === 1 && results[0].outcome !== 'error') {
    return { message: results[0].message, variant: results[0].outcome === 'updated' ? 'success' : 'info' };
  }
  const count = (outcome: ClickResult['outcome']) => results.filter((result) => result.outcome === outcome).length;
  const cost = results.reduce((total, result) => total + (result.run?.costUsd ?? 0), 0);
  const parts = [`${count('updated')} updated`];
  if (count('skipped') > 0) parts.push(`${count('skipped')} already filled`);
  if (count('not_found') > 0) parts.push(`${count('not_found')} not found`);
  if (count('error') > 0) parts.push(`${count('error')} failed`);
  if (selectedCount > results.length) parts.push(`${selectedCount - results.length} not run`);
  const firstError = results.find((result) => result.outcome === 'error');
  const message = `looot: ${parts.join(', ')}. Spent $${cost.toFixed(4)}.${firstError ? ` First error: ${firstError.message}` : ''}`;
  if (count('error') === results.length) return { message, variant: 'error' };
  return { message, variant: count('updated') > 0 ? 'success' : 'info' };
};
