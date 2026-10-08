import { describe, expect, it } from 'vitest';

import { enrichCompanyRecord, enrichPersonRecord, readRecordId, type RecordsApi } from 'src/lib/records';
import { summarizeResults } from 'src/lib/summary';

const env = { LOOOT_TOKEN: 'test-token' } as NodeJS.ProcessEnv;
const PERSON_ID = '11111111-1111-4111-8111-111111111111';
const COMPANY_ID = '22222222-2222-4222-8222-222222222222';

const fakeFetch = (body: unknown) => {
  const calls: Record<string, unknown>[] = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body ?? '{}')));
    return new Response(JSON.stringify(body), { status: 201 });
  }) as typeof fetch;
  return { fetchImpl, calls };
};

/** A stand-in for Twenty's REST API holding one record per path. */
const fakeApi = (records: Record<string, unknown>) => {
  const gets: { path: string; query?: Record<string, string | number> }[] = [];
  const patches: { path: string; body: unknown }[] = [];
  const api: RecordsApi = {
    get: async <T>(path: string, options?: { query?: Record<string, string | number> }) => {
      gets.push({ path, query: options?.query });
      return (records[path] ?? { data: {} }) as T;
    },
    patch: async <T>(path: string, body?: unknown) => {
      patches.push({ path, body });
      return {} as T;
    },
  };
  return { api, gets, patches };
};

describe('enrichPersonRecord', () => {
  const person = {
    id: PERSON_ID,
    name: { firstName: 'Jane', lastName: 'Doe' },
    emails: { primaryEmail: '' },
    company: { name: 'Example Inc', domainName: { primaryLinkUrl: 'https://example.com' } },
  };

  it('reads the person with their company, finds the email and writes it', async () => {
    const { api, gets, patches } = fakeApi({ [`/rest/people/${PERSON_ID}`]: { data: { person } } });
    const { fetchImpl, calls } = fakeFetch({
      runId: 'run_1',
      status: 'completed',
      actualCost: 0.003598,
      normalized: { fields: { email: 'jane.doe@example.com', check: 'valid' } },
    });
    const result = await enrichPersonRecord(api, PERSON_ID, { env, fetchImpl });
    expect(gets[0]).toEqual({ path: `/rest/people/${PERSON_ID}`, query: { depth: 1 } });
    expect(calls[0].input).toEqual({ first_name: 'Jane', last_name: 'Doe', domain: 'https://example.com', company: 'Example Inc' });
    expect(patches).toEqual([{ path: `/rest/people/${PERSON_ID}`, body: { emails: { primaryEmail: 'jane.doe@example.com' } } }]);
    expect(result).toMatchObject({ outcome: 'updated', message: 'Added jane.doe@example.com (valid).', updatedFields: ['emails.primaryEmail'] });
    expect(result.run).toEqual({ runId: 'run_1', status: 'completed', costUsd: 0.003598, provider: null });
  });

  it('skips a person who already has an email without calling looot', async () => {
    const { api, patches } = fakeApi({
      [`/rest/people/${PERSON_ID}`]: { data: { person: { ...person, emails: { primaryEmail: 'jane@example.com' } } } },
    });
    const { fetchImpl, calls } = fakeFetch({});
    const result = await enrichPersonRecord(api, PERSON_ID, { env, fetchImpl });
    expect(result.outcome).toBe('skipped');
    expect(result.run).toBeNull();
    expect(calls).toHaveLength(0);
    expect(patches).toHaveLength(0);
  });

  it('leaves the record alone when looot finds nothing', async () => {
    const { api, patches } = fakeApi({ [`/rest/people/${PERSON_ID}`]: { data: { person } } });
    const { fetchImpl } = fakeFetch({ runId: 'run_2', status: 'completed', result: {} });
    const result = await enrichPersonRecord(api, PERSON_ID, { env, fetchImpl });
    expect(result.outcome).toBe('not_found');
    expect(patches).toHaveLength(0);
  });

  it('raises when the person does not exist', async () => {
    const { api } = fakeApi({});
    await expect(enrichPersonRecord(api, PERSON_ID, { env, fetchImpl: fakeFetch({}).fetchImpl })).rejects.toThrow(/was not found/);
  });
});

describe('enrichCompanyRecord', () => {
  const company = { id: COMPANY_ID, name: 'Example', domainName: { primaryLinkUrl: 'example.com' }, loootIndustry: '', loootCompanySize: null };
  const run = { runId: 'run_3', status: 'completed', actualCost: 0.0019, normalized: { fields: { name: 'Example Inc', industry: 'Software', size: '51-200' } } };

  it('fills the empty industry and size fields and keeps the existing name', async () => {
    const { api, patches } = fakeApi({ [`/rest/companies/${COMPANY_ID}`]: { data: { company } } });
    const { fetchImpl, calls } = fakeFetch(run);
    const result = await enrichCompanyRecord(api, COMPANY_ID, { env, fetchImpl });
    expect(calls[0].input).toEqual({ domain: 'example.com', name: 'Example' });
    expect(patches).toEqual([{ path: `/rest/companies/${COMPANY_ID}`, body: { loootIndustry: 'Software', loootCompanySize: '51-200' } }]);
    expect(result.outcome).toBe('updated');
    expect(result.updatedFields).toEqual(['loootIndustry', 'loootCompanySize']);
  });

  it('does not overwrite a field that already has a value', async () => {
    const { api, patches } = fakeApi({ [`/rest/companies/${COMPANY_ID}`]: { data: { company: { ...company, loootIndustry: 'Fintech' } } } });
    await enrichCompanyRecord(api, COMPANY_ID, { env, fetchImpl: fakeFetch(run).fetchImpl });
    expect(patches[0].body).toEqual({ loootCompanySize: '51-200' });
  });

  it('skips a company with both fields filled without calling looot', async () => {
    const { api } = fakeApi({ [`/rest/companies/${COMPANY_ID}`]: { data: { company: { ...company, loootIndustry: 'Fintech', loootCompanySize: '11-50' } } } });
    const { fetchImpl, calls } = fakeFetch(run);
    const result = await enrichCompanyRecord(api, COMPANY_ID, { env, fetchImpl });
    expect(result.outcome).toBe('skipped');
    expect(calls).toHaveLength(0);
  });

  it('reports not found when looot returns no industry or size', async () => {
    const { api, patches } = fakeApi({ [`/rest/companies/${COMPANY_ID}`]: { data: { company } } });
    const result = await enrichCompanyRecord(api, COMPANY_ID, { env, fetchImpl: fakeFetch({ runId: 'run_4', status: 'completed' }).fetchImpl });
    expect(result.outcome).toBe('not_found');
    expect(patches).toHaveLength(0);
  });
});

describe('readRecordId', () => {
  it('accepts a record id and refuses anything else', () => {
    expect(readRecordId({ recordId: PERSON_ID })).toBe(PERSON_ID);
    expect(() => readRecordId({ recordId: '../people' })).toThrow(/recordId must be/);
    expect(() => readRecordId(null)).toThrow(/recordId must be/);
  });
});

describe('summarizeResults', () => {
  it('shows the record message for one record', () => {
    expect(summarizeResults([{ outcome: 'updated', message: 'Added jane.doe@example.com (valid).', run: { costUsd: 0.0036 } }], 1)).toEqual({
      message: 'Added jane.doe@example.com (valid).',
      variant: 'success',
    });
  });

  it('counts outcomes and adds up the cost for several records', () => {
    const summary = summarizeResults(
      [
        { outcome: 'updated', message: '', run: { costUsd: 0.0036 } },
        { outcome: 'skipped', message: '', run: null },
        { outcome: 'not_found', message: '', run: { costUsd: 0.0036 } },
        { outcome: 'error', message: 'Balance too low.', run: null },
      ],
      30,
    );
    expect(summary.message).toBe('looot: 1 updated, 1 already filled, 1 not found, 1 failed, 26 not run. Spent $0.0072. First error: Balance too low.');
    expect(summary.variant).toBe('success');
  });

  it('is an error when every record failed', () => {
    expect(summarizeResults([{ outcome: 'error', message: 'no token', run: null }], 1).variant).toBe('error');
  });
});
