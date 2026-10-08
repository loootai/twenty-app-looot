import { defineCommandMenuItem, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  ENRICH_PERSON_COMMAND_UNIVERSAL_IDENTIFIER,
  ENRICH_PERSON_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: ENRICH_PERSON_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'Find work email with looot',
  shortLabel: 'Find email',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  frontComponentUniversalIdentifier: ENRICH_PERSON_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
