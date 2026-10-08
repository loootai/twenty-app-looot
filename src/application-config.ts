import { defineApplication, FieldType } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
  LOOOT_MAX_COST_VARIABLE_UNIVERSAL_IDENTIFIER,
  LOOOT_TOKEN_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  author: 'looot',
  category: 'Enrichment',
  logo: 'public/logo.png',
  websiteUrl: 'https://looot.ai',
  termsUrl: 'https://looot.ai/terms',
  issueReportUrl: 'https://github.com/loootai/twenty-app-looot/issues',
  applicationVariables: {
    LOOOT_TOKEN: {
      universalIdentifier: LOOOT_TOKEN_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'looot agent token',
      description:
        'Create one in the looot dashboard under Settings, Agent tokens, with catalog.read, runs.read, runs.execute and usage.read.',
      isSecret: true,
      isRequired: true,
    },
    LOOOT_MAX_COST_USD: {
      universalIdentifier: LOOOT_MAX_COST_VARIABLE_UNIVERSAL_IDENTIFIER,
      label: 'Max cost per lookup (USD)',
      description:
        'The most one lookup may spend across the providers looot tries. Leave empty for the looot default.',
      type: FieldType.NUMBER,
      isSecret: false,
    },
  },
});
