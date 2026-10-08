import { defineHealthCheck } from 'twenty-sdk/define';

import { HEALTH_CHECK_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { LOOOT_BASE_URL } from 'src/lib/looot';

// Reads the balance, a free call, to tell a revoked token or an empty balance from a working setup.
export default defineHealthCheck({
  universalIdentifier: HEALTH_CHECK_UNIVERSAL_IDENTIFIER,
  name: 'health-check',
  handler: async () => {
    const token = (process.env.LOOOT_TOKEN ?? '').trim();
    if (token === '') return { status: 'OK' as const };
    const response = await fetch(`${LOOOT_BASE_URL}/v1/balance`, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401) {
      return {
        status: 'ERROR' as const,
        title: 'The looot agent token is not valid',
        description: 'Create a new token in the looot dashboard under Settings, Agent tokens, and paste it here.',
      };
    }
    if (!response.ok) return { status: 'OK' as const };
    const balance = (await response.json()) as { available?: number };
    if (typeof balance.available === 'number' && balance.available <= 0) {
      return {
        status: 'WARNING' as const,
        title: 'Your looot balance is empty',
        description: 'Top up at looot.ai. Lookups are refused, at no cost, until the balance is positive.',
      };
    }
    return { status: 'OK' as const };
  },
});
