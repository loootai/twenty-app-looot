import { defineCommandMenuItem, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  ENRICH_COMPANY_COMMAND_UNIVERSAL_IDENTIFIER,
  ENRICH_COMPANY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: ENRICH_COMPANY_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'Enrich with looot',
  shortLabel: 'Enrich',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  frontComponentUniversalIdentifier: ENRICH_COMPANY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
