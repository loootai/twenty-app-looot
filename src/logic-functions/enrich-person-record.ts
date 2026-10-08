import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { RoutePayload } from 'twenty-sdk/logic-function';

import { ENRICH_PERSON_RECORD_UNIVERSAL_IDENTIFIER, ENRICH_PERSON_ROUTE } from 'src/constants/universal-identifiers';
import { enrichPersonRecord, readRecordId } from 'src/lib/records';

export default defineLogicFunction({
  universalIdentifier: ENRICH_PERSON_RECORD_UNIVERSAL_IDENTIFIER,
  name: 'looot-enrich-person-record',
  description: 'Finds the work email of one person record through looot and saves it when the record has none.',
  timeoutSeconds: 45,
  handler: async (event: RoutePayload) => enrichPersonRecord(new RestApiClient(), readRecordId(event.body)),
  httpRouteTriggerSettings: {
    path: ENRICH_PERSON_ROUTE,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
