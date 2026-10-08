import { defineLogicFunction } from 'twenty-sdk/define';
import { jsonSchemaToInputSchema, type InputJsonSchema } from 'twenty-sdk/logic-function';

import { FIND_WORK_EMAIL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { findWorkEmail, type FindWorkEmailParams } from 'src/lib/actions';

const inputSchema: InputJsonSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string', label: 'First name', description: 'First name of the person' },
    lastName: { type: 'string', label: 'Last name', description: 'Last name of the person' },
    fullName: { type: 'string', label: 'Full name', description: 'Use when the name is in one field' },
    domain: { type: 'string', label: 'Company domain', description: 'For example example.com. A full URL also works' },
    companyName: { type: 'string', label: 'Company name', description: 'Use when there is no domain' },
    linkedinUrl: { type: 'string', label: 'LinkedIn URL', description: 'LinkedIn profile URL of the person' },
  },
};

export default defineLogicFunction({
  universalIdentifier: FIND_WORK_EMAIL_UNIVERSAL_IDENTIFIER,
  name: 'looot-find-work-email',
  description:
    'Finds the work email of a person from their name and company domain through looot. Spends looot credit; a failed call costs nothing.',
  timeoutSeconds: 40,
  handler: async (params: FindWorkEmailParams) => findWorkEmail(params),
  toolTriggerSettings: { inputSchema },
  workflowActionTriggerSettings: {
    label: 'Find work email (looot)',
    icon: 'IconMailSearch',
    inputSchema: jsonSchemaToInputSchema(inputSchema),
    outputSchema: [
      {
        type: 'object',
        properties: {
          found: { type: 'boolean' },
          email: { type: 'string' },
          check: { type: 'string' },
          runId: { type: 'string' },
          status: { type: 'string' },
          costUsd: { type: 'number' },
          provider: { type: 'string' },
        },
      },
    ],
  },
});
