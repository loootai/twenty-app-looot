import { describe, expect, it } from 'vitest';

import { enrichCompany, findWorkEmail, verifyEmail } from 'src/lib/actions';
import { buildIdempotencyKey, cleanInput, LoootError, readSettings, runLoootJob, toStableJson } from 'src/lib/looot';

const env = { LOOOT_TOKEN: 'test-token' } as NodeJS.ProcessEnv;
const now = new Date('2026-10-08T10:00:00Z');

/** A fetch stand-in that records the request and answers with the given status and body. */
const fakeFetch = (status: number, body: unknown) => {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fetchImpl, calls };
};

describe('runLoootJob', () => {
  it('posts the documented body to /v1/runs with the bearer token', async () => {
    const { fetchImpl, calls } = fakeFetch(201, { runId: 'run_1', status: 'completed', actualCost: 0.0019 });
    const run = await runLoootJob('job:company.enrich', { domain: 'example.com' }, { env, fetchImpl, now });
    expect(run.runId).toBe('run_1');
    expect(calls[0].url).toBe('https://api.looot.ai/v1/runs');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    expect(Object.keys(calls[0].body).sort()).toEqual(['endpointId', 'fallback', 'idempotencyKey', 'input', 'wait']);
    expect(calls[0].body.endpointId).toBe('job:company.enrich');
    expect(calls[0].body.input).toEqual({ domain: 'example.com' });
    expect(calls[0].body.fallback).toBe(true);
    expect(calls[0].body.wait).toBe(25);
    expect(calls[0].body.idempotencyKey).toMatch(/^twenty-[0-9a-f]{40}$/);
  });

  it('sends the cost cap when the variable is set', async () => {
    const { fetchImpl, calls } = fakeFetch(201, { runId: 'run_1', status: 'completed' });
    await runLoootJob('job:company.enrich', { domain: 'example.com' }, { env: { ...env, LOOOT_MAX_COST_USD: '0.05' }, fetchImpl, now });
    expect(calls[0].body.fallback).toEqual({ enabled: true, maxCostUsd: 0.05 });
  });

  it('refuses to call looot without a token', async () => {
    const { fetchImpl, calls } = fakeFetch(201, {});
    await expect(runLoootJob('job:x', {}, { env: {} as NodeJS.ProcessEnv, fetchImpl })).rejects.toThrow(/Add your looot agent token/);
    expect(calls).toHaveLength(0);
  });

  it('turns 401, 402 and other refusals into readable errors', async () => {
    await expect(
      runLoootJob('job:x', {}, { env, fetchImpl: fakeFetch(401, { error: { code: 'unauthorized', message: 'no' } }).fetchImpl }),
    ).rejects.toThrow(/token is not valid/);
    await expect(
      runLoootJob('job:x', {}, {
        env,
        fetchImpl: fakeFetch(402, { error: { code: 'insufficient_balance', message: 'Balance too low.' }, topUp: { dashboardUrl: 'https://looot.ai/billing' } }).fetchImpl,
      }),
    ).rejects.toThrow('Balance too low. Nothing was charged. Top up at https://looot.ai/billing');
    await expect(
      runLoootJob('job:x', {}, { env, fetchImpl: fakeFetch(429, { error: { code: 'too_many_inflight_runs', message: 'Too many runs' } }).fetchImpl }),
    ).rejects.toMatchObject({ code: 'too_many_inflight_runs' });
  });

  it('raises when a run comes back failed with HTTP 201', async () => {
    const { fetchImpl } = fakeFetch(201, { runId: 'run_9', status: 'failed', error: { code: 'invalid_input', message: 'email needs a domain' } });
    const error = await runLoootJob('job:x', {}, { env, fetchImpl }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LoootError);
    expect((error as LoootError).message).toBe('looot run run_9 ended failed: email needs a domain');
    expect((error as LoootError).code).toBe('invalid_input');
  });
});

describe('helpers', () => {
  it('cleanInput trims and drops empty values', () => {
    expect(cleanInput({ a: ' x ', b: '', c: null, d: undefined, e: '  ' })).toEqual({ a: 'x' });
  });

  it('the idempotency key is stable for the same input and day, and changes otherwise', () => {
    const key = buildIdempotencyKey('job:x', { b: '1', a: '2' }, now);
    expect(buildIdempotencyKey('job:x', { a: '2', b: '1' }, new Date('2026-10-08T23:59:00Z'))).toBe(key);
    expect(buildIdempotencyKey('job:x', { a: '2', b: '2' }, now)).not.toBe(key);
    expect(buildIdempotencyKey('job:y', { a: '2', b: '1' }, now)).not.toBe(key);
    expect(buildIdempotencyKey('job:x', { a: '2', b: '1' }, new Date('2026-10-09T00:00:01Z'))).not.toBe(key);
    expect(toStableJson({ b: [1, { d: 1, c: 2 }], a: null })).toBe('{"a":null,"b":[1,{"c":2,"d":1}]}');
  });

  it('readSettings ignores a cost cap that is not a positive number', () => {
    expect(readSettings({ LOOOT_TOKEN: ' t ', LOOOT_MAX_COST_USD: 'abc' } as NodeJS.ProcessEnv)).toEqual({ token: 't', maxCostUsd: null });
    expect(readSettings({ LOOOT_TOKEN: 't', LOOOT_MAX_COST_USD: '0' } as NodeJS.ProcessEnv).maxCostUsd).toBeNull();
  });
});

describe('actions', () => {
  it('findWorkEmail maps Twenty names to looot job inputs and reads the normalized email', async () => {
    const { fetchImpl, calls } = fakeFetch(201, {
      runId: 'run_2',
      status: 'completed',
      actualCost: 0.003598,
      servedProviderId: 'icypeas',
      normalized: { fields: { email: 'jane.doe@example.com', check: 'valid' } },
    });
    const result = await findWorkEmail({ firstName: 'Jane', lastName: 'Doe', domain: 'example.com', fullName: null }, { env, fetchImpl, now });
    expect(calls[0].body.endpointId).toBe('job:people.email.find');
    expect(calls[0].body.input).toEqual({ first_name: 'Jane', last_name: 'Doe', domain: 'example.com' });
    expect(result).toEqual({
      runId: 'run_2',
      status: 'completed',
      costUsd: 0.003598,
      provider: 'icypeas',
      found: true,
      email: 'jane.doe@example.com',
      check: 'valid',
    });
  });

  it('findWorkEmail reports not found when the run has no normalized email', async () => {
    const { fetchImpl } = fakeFetch(201, { runId: 'run_3', status: 'completed', result: {} });
    const result = await findWorkEmail({ fullName: 'Jane Doe', companyName: 'Example' }, { env, fetchImpl, now });
    expect(result.found).toBe(false);
    expect(result.email).toBeNull();
    expect(result.costUsd).toBe(0);
  });

  it('findWorkEmail refuses input looot cannot use, before any call', async () => {
    const { fetchImpl, calls } = fakeFetch(201, {});
    await expect(findWorkEmail({ domain: 'example.com' }, { env, fetchImpl })).rejects.toThrow(/first and last name/);
    await expect(findWorkEmail({ firstName: 'Jane', lastName: 'Doe' }, { env, fetchImpl })).rejects.toThrow(/company domain/);
    expect(calls).toHaveLength(0);
  });

  it('verifyEmail returns the status and the deliverable flag', async () => {
    const { fetchImpl, calls } = fakeFetch(201, {
      runId: 'run_4',
      status: 'completed',
      normalized: { fields: { email: 'jane.doe@example.com', status: 'catch_all', deliverable: false } },
    });
    const result = await verifyEmail({ email: ' jane.doe@example.com ' }, { env, fetchImpl, now });
    expect(calls[0].body.endpointId).toBe('job:people.email.verify');
    expect(calls[0].body.input).toEqual({ email: 'jane.doe@example.com' });
    expect(result.emailStatus).toBe('catch_all');
    expect(result.deliverable).toBe(false);
    await expect(verifyEmail({ email: '' }, { env, fetchImpl })).rejects.toThrow(/email address to verify/);
  });

  it('enrichCompany sends the domain or the name and reads industry and size', async () => {
    const { fetchImpl, calls } = fakeFetch(201, {
      runId: 'run_5',
      status: 'completed',
      actualCost: 0.0019,
      normalized: { fields: { name: 'Example Inc', domain: 'example.com', industry: 'Software', size: '51-200' } },
    });
    const result = await enrichCompany({ domain: 'https://example.com/about', companyName: 'Example' }, { env, fetchImpl, now });
    expect(calls[0].body.endpointId).toBe('job:company.enrich');
    expect(calls[0].body.input).toEqual({ domain: 'https://example.com/about', name: 'Example' });
    expect(result).toMatchObject({ found: true, companyName: 'Example Inc', industry: 'Software', size: '51-200', costUsd: 0.0019 });
    await expect(enrichCompany({}, { env, fetchImpl })).rejects.toThrow(/company domain or a company name/);
  });
});
