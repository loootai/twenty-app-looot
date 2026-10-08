import { defineLogicFunction } from 'twenty-sdk/define';
import { jsonSchemaToInputSchema, type InputJsonSchema } from 'twenty-sdk/logic-function';

import { ENRICH_COMPANY_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { enrichCompany, type EnrichCompanyParams } from 'src/lib/actions';

const inputSchema: InputJsonSchema = {
  type: 'object',
  properties: {
    domain: { type: 'string', label: 'Company domain', description: 'For example example.com. A full URL also works' },
    companyName: { type: 'string', label: 'Company name', description: 'Use when there is no domain' },
  },
};

export default defineLogicFunction({
  universalIdentifier: ENRICH_COMPANY_UNIVERSAL_IDENTIFIER,
  name: 'looot-enrich-company',
  description:
    'Gets the name, industry and size of a company from its domain or name through looot. Spends looot credit.',
  timeoutSeconds: 40,
  handler: async (params: EnrichCompanyParams) => enrichCompany(params),
  toolTriggerSettings: { inputSchema },
  workflowActionTriggerSettings: {
    label: 'Enrich company (looot)',
    icon: 'IconBuildingSkyscraper',
    inputSchema: jsonSchemaToInputSchema(inputSchema),
    outputSchema: [
      {
        type: 'object',
        properties: {
          found: { type: 'boolean' },
          companyName: { type: 'string' },
          companyDomain: { type: 'string' },
          industry: { type: 'string' },
          size: { type: 'string' },
          runId: { type: 'string' },
          status: { type: 'string' },
          costUsd: { type: 'number' },
          provider: { type: 'string' },
        },
      },
    ],
  },
});
