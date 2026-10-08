import { defineLogicFunction } from 'twenty-sdk/define';
import { jsonSchemaToInputSchema, type InputJsonSchema } from 'twenty-sdk/logic-function';

import { VERIFY_EMAIL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { verifyEmail, type VerifyEmailParams } from 'src/lib/actions';

const inputSchema: InputJsonSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', label: 'Email', description: 'The email address to check' },
  },
  required: ['email'],
};

export default defineLogicFunction({
  universalIdentifier: VERIFY_EMAIL_UNIVERSAL_IDENTIFIER,
  name: 'looot-verify-email',
  description:
    'Checks whether an email address is deliverable through looot. Returns a status: valid, invalid, catch_all, risky or unknown. Spends looot credit.',
  timeoutSeconds: 40,
  handler: async (params: VerifyEmailParams) => verifyEmail(params),
  toolTriggerSettings: { inputSchema },
  workflowActionTriggerSettings: {
    label: 'Verify email (looot)',
    icon: 'IconMailCheck',
    inputSchema: jsonSchemaToInputSchema(inputSchema),
    outputSchema: [
      {
        type: 'object',
        properties: {
          email: { type: 'string' },
          emailStatus: { type: 'string' },
          deliverable: { type: 'boolean' },
          runId: { type: 'string' },
          status: { type: 'string' },
          costUsd: { type: 'number' },
          provider: { type: 'string' },
        },
      },
    ],
  },
});
