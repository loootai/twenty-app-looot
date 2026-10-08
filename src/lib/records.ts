import { enrichCompany, findWorkEmail } from 'src/lib/actions';
import { LoootError, type LoootRunSummary } from 'src/lib/looot';

/** The two calls the record actions make against Twenty's REST API. */
export type RecordsApi = {
  get: <T = unknown>(path: string, options?: { query?: Record<string, string | number> }) => Promise<T>;
  patch: <T = unknown>(path: string, body?: unknown) => Promise<T>;
};

type RunOptions = Parameters<typeof findWorkEmail>[1];

type PersonRecord = {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  emails?: { primaryEmail?: string | null } | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  company?: { name?: string | null; domainName?: { primaryLinkUrl?: string | null } | null } | null;
};

type CompanyRecord = {
  id: string;
  name?: string | null;
  domainName?: { primaryLinkUrl?: string | null } | null;
  loootIndustry?: string | null;
  loootCompanySize?: string | null;
};

export type RecordResult = {
  recordId: string;
  outcome: 'updated' | 'skipped' | 'not_found';
  message: string;
  updatedFields: string[];
  run: LoootRunSummary | null;
};

const pickRun = ({ runId, status, costUsd, provider }: LoootRunSummary): LoootRunSummary => ({ runId, status, costUsd, provider });

const isBlank = (value: string | null | undefined): boolean => value === null || value === undefined || value.trim() === '';

/**
 * Finds the work email of one person and writes it to the record. Skips a person who already
 * has an email, so a second click never pays for the same lookup or overwrites a value.
 */
export const enrichPersonRecord = async (api: RecordsApi, recordId: string, options?: RunOptions): Promise<RecordResult> => {
  const answer = await api.get<{ data?: { person?: PersonRecord } }>(`/rest/people/${recordId}`, { query: { depth: 1 } });
  const person = answer.data?.person;
  if (!person) throw new LoootError(`Person ${recordId} was not found.`, 'record_not_found');
  if (!isBlank(person.emails?.primaryEmail)) {
    return { recordId, outcome: 'skipped', message: 'This person already has an email.', updatedFields: [], run: null };
  }
  const found = await findWorkEmail(
    {
      firstName: person.name?.firstName,
      lastName: person.name?.lastName,
      domain: person.company?.domainName?.primaryLinkUrl,
      companyName: person.company?.name,
      linkedinUrl: person.linkedinLink?.primaryLinkUrl,
    },
    options,
  );
  const { email, check } = found;
  const run = pickRun(found);
  if (!found.found || email === null) {
    return { recordId, outcome: 'not_found', message: 'looot found no work email for this person.', updatedFields: [], run };
  }
  await api.patch(`/rest/people/${recordId}`, { emails: { primaryEmail: email } });
  return {
    recordId,
    outcome: 'updated',
    message: `Added ${email}${check ? ` (${check})` : ''}.`,
    updatedFields: ['emails.primaryEmail'],
    run,
  };
};

/**
 * Enriches one company and writes the industry and size looot returns into the two fields this
 * app adds. Fills empty fields only; a company with both already set is skipped at no cost.
 */
export const enrichCompanyRecord = async (api: RecordsApi, recordId: string, options?: RunOptions): Promise<RecordResult> => {
  const answer = await api.get<{ data?: { company?: CompanyRecord } }>(`/rest/companies/${recordId}`);
  const company = answer.data?.company;
  if (!company) throw new LoootError(`Company ${recordId} was not found.`, 'record_not_found');
  if (!isBlank(company.loootIndustry) && !isBlank(company.loootCompanySize)) {
    return { recordId, outcome: 'skipped', message: 'Industry and size are already filled.', updatedFields: [], run: null };
  }
  const enriched = await enrichCompany({ domain: company.domainName?.primaryLinkUrl, companyName: company.name }, options);
  const { found, industry, size, companyName } = enriched;
  const run = pickRun(enriched);
  const update: Record<string, string> = {};
  if (isBlank(company.loootIndustry) && industry !== null) update.loootIndustry = industry;
  if (isBlank(company.loootCompanySize) && size !== null) update.loootCompanySize = size;
  if (isBlank(company.name) && companyName !== null) update.name = companyName;
  if (!found || Object.keys(update).length === 0) {
    return { recordId, outcome: 'not_found', message: 'looot returned no industry or size for this company.', updatedFields: [], run };
  }
  await api.patch(`/rest/companies/${recordId}`, update);
  return {
    recordId,
    outcome: 'updated',
    message: `Filled ${Object.keys(update).join(', ')}.`,
    updatedFields: Object.keys(update),
    run,
  };
};

/** Reads and checks the record id a front component sent in the request body. */
export const readRecordId = (body: unknown): string => {
  const recordId = (body as { recordId?: unknown } | null)?.recordId;
  if (typeof recordId !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(recordId)) {
    throw new LoootError('recordId must be the id of a record.', 'invalid_record_id');
  }
  return recordId;
};
