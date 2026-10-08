import { defineFrontComponent } from 'twenty-sdk/define';

import { ENRICH_PERSON_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER, ENRICH_PERSON_ROUTE } from 'src/constants/universal-identifiers';
import { EnrichRecords } from 'src/front-components/enrich-records';

const EnrichPerson = () => (
  <EnrichRecords
    route={ENRICH_PERSON_ROUTE}
    title="Find work email with looot?"
    subtitle="Each lookup spends looot credit. People who already have an email are skipped at no cost."
  />
);

export default defineFrontComponent({
  universalIdentifier: ENRICH_PERSON_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'looot-enrich-person',
  description: 'Finds the work email of the selected people through looot',
  isHeadless: true,
  component: EnrichPerson,
});
