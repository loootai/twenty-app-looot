import {
  cleanInput,
  JOB_ENRICH_COMPANY,
  JOB_FIND_WORK_EMAIL,
  JOB_VERIFY_EMAIL,
  LoootError,
  type LoootRunSummary,
  readField,
  runLoootJob,
  summarizeRun,
} from 'src/lib/looot';

type RunOptions = Parameters<typeof runLoootJob>[2];

export type FindWorkEmailParams = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  domain?: string | null;
  companyName?: string | null;
  linkedinUrl?: string | null;
};
export type FindWorkEmailResult = LoootRunSummary & { found: boolean; email: string | null; check: string | null };

/** Finds a person's work email through looot's people.email.find job. */
export const findWorkEmail = async (params: FindWorkEmailParams, options?: RunOptions): Promise<FindWorkEmailResult> => {
  const input = cleanInput({
    first_name: params.firstName,
    last_name: params.lastName,
    name: params.fullName,
    domain: params.domain,
    company: params.companyName,
    linkedin_url: params.linkedinUrl,
  });
  const hasName = Boolean(input.name) || (Boolean(input.first_name) && Boolean(input.last_name));
  if (!hasName && !input.linkedin_url) {
    throw new LoootError('Give a first and last name, a full name, or a LinkedIn URL.', 'missing_person');
  }
  if (!input.domain && !input.company && !input.linkedin_url) {
    throw new LoootError('Give a company domain, a company name, or a LinkedIn URL.', 'missing_company');
  }
  const run = await runLoootJob(JOB_FIND_WORK_EMAIL, input, options);
  const email = readField(run, 'email');
  return { ...summarizeRun(run), found: email !== null, email, check: readField(run, 'check') };
};

export type VerifyEmailParams = { email?: string | null };
export type VerifyEmailResult = LoootRunSummary & { email: string; emailStatus: string | null; deliverable: boolean | null };

/** Checks whether an email address is deliverable through looot's people.email.verify job. */
export const verifyEmail = async (params: VerifyEmailParams, options?: RunOptions): Promise<VerifyEmailResult> => {
  const input = cleanInput({ email: params.email });
  if (!input.email) throw new LoootError('Give an email address to verify.', 'missing_email');
  const run = await runLoootJob(JOB_VERIFY_EMAIL, input, options);
  const deliverable = run.normalized?.fields?.deliverable;
  return {
    ...summarizeRun(run),
    email: readField(run, 'email') ?? input.email,
    emailStatus: readField(run, 'status'),
    deliverable: typeof deliverable === 'boolean' ? deliverable : null,
  };
};

export type EnrichCompanyParams = { domain?: string | null; companyName?: string | null };
export type EnrichCompanyResult = LoootRunSummary & {
  found: boolean;
  companyName: string | null;
  companyDomain: string | null;
  industry: string | null;
  size: string | null;
};

/** Gets a company's name, industry and size through looot's company.enrich job. */
export const enrichCompany = async (params: EnrichCompanyParams, options?: RunOptions): Promise<EnrichCompanyResult> => {
  const input = cleanInput({ domain: params.domain, name: params.companyName });
  if (!input.domain && !input.name) {
    throw new LoootError('Give a company domain or a company name.', 'missing_company');
  }
  const run = await runLoootJob(JOB_ENRICH_COMPANY, input, options);
  const industry = readField(run, 'industry');
  const size = readField(run, 'size');
  return {
    ...summarizeRun(run),
    found: industry !== null || size !== null,
    companyName: readField(run, 'name'),
    companyDomain: readField(run, 'domain'),
    industry,
    size,
  };
};
