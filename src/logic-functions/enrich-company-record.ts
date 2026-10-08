import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { ENRICH_COMPANY_RECORD_UNIVERSAL_IDENTIFIER, ENRICH_COMPANY_ROUTE } from 'src/constants/universal-identifiers';
import { enrichCompanyRecord, readRecordId } from 'src/lib/records';

export default defineLogicFunction({
  universalIdentifier: ENRICH_COMPANY_RECORD_UNIVERSAL_IDENTIFIER,
  name: 'looot-enrich-company-record',
  description: 'Enriches one company record through looot and fills its empty industry and size fields.',
  timeoutSeconds: 45,
  handler: async (event: RoutePayload) => enrichCompanyRecord(new RestApiClient(), readRecordId(event.body)),
  httpRouteTriggerSettings: {
    path: ENRICH_COMPANY_ROUTE,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
