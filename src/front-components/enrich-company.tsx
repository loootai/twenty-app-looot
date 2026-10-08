import { defineFrontComponent } from 'twenty-sdk/define';

import { ENRICH_COMPANY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER, ENRICH_COMPANY_ROUTE } from 'src/constants/universal-identifiers';
import { EnrichRecords } from 'src/front-components/enrich-records';

const EnrichCompany = () => (
  <EnrichRecords
    route={ENRICH_COMPANY_ROUTE}
    title="Enrich with looot?"
    subtitle="Each lookup spends looot credit. Companies with industry and size already filled are skipped at no cost."
  />
);

export default defineFrontComponent({
  universalIdentifier: ENRICH_COMPANY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'looot-enrich-company',
  description: 'Fills the industry and size of the selected companies through looot',
  isHeadless: true,
  component: EnrichCompany,
});
