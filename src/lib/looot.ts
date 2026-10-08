import { createHash } from 'node:crypto';

export const LOOOT_BASE_URL = 'https://api.looot.ai';
export const JOB_FIND_WORK_EMAIL = 'job:people.email.find';
export const JOB_VERIFY_EMAIL = 'job:people.email.verify';
export const JOB_ENRICH_COMPANY = 'job:company.enrich';
const WAIT_SECONDS = 25;

export type LoootInput = Record<string, string>;

export type LoootRun = {
  runId: string;
  status: string;
  actualCost?: number;
  servedProviderId?: string;
  outcome?: string;
  result?: unknown;
  normalized?: { fields?: Record<string, unknown> };
  error?: { code?: string; message?: string };
};

/** What every looot action returns besides its own fields. */
export type LoootRunSummary = {
  runId: string;
  status: string;
  costUsd: number;
  provider: string | null;
};

/** An error looot or this app raised, with a message written for the person using Twenty. */
export class LoootError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'LoootError';
  }
}

/** Drops empty values and trims the rest, so looot only reads the fields that were filled. */
export const cleanInput = (input: Record<string, string | null | undefined>): LoootInput =>
  Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : ''])
      .filter(([, value]) => value !== ''),
  );

/** Serializes a value with sorted keys, so the same input always gives the same string. */
export const toStableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(toStableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${toStableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

/**
 * Builds the idempotency key from the job, the input and the UTC date. Running the same lookup
 * twice on one day replays the first looot run and pays once; the next day it runs fresh.
 */
export const buildIdempotencyKey = (endpointId: string, input: LoootInput, now: Date = new Date()): string => {
  const day = now.toISOString().slice(0, 10);
  const digest = createHash('sha256').update(`${endpointId}|${toStableJson(input)}|${day}`).digest('hex');
  return `twenty-${digest.slice(0, 40)}`;
};

/** Reads the token and the optional cost cap from the app's variables. */
export const readSettings = (env: NodeJS.ProcessEnv = process.env): { token: string; maxCostUsd: number | null } => {
  const token = (env.LOOOT_TOKEN ?? '').trim();
  if (token === '') {
    throw new LoootError('Add your looot agent token in the looot app settings in Twenty.', 'missing_token');
  }
  const cap = Number(env.LOOOT_MAX_COST_USD);
  return { token, maxCostUsd: Number.isFinite(cap) && cap > 0 ? cap : null };
};

/**
 * Runs one looot job with fallback across providers and waits for the answer. Throws a
 * LoootError when looot refuses the call or the run ends failed, blocked or stopped.
 */
export const runLoootJob = async (
  endpointId: string,
  input: LoootInput,
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<LoootRun> => {
  const { token, maxCostUsd } = readSettings(options.env);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${LOOOT_BASE_URL}/v1/runs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      endpointId,
      input,
      idempotencyKey: buildIdempotencyKey(endpointId, input, options.now),
      wait: WAIT_SECONDS,
      fallback: maxCostUsd === null ? true : { enabled: true, maxCostUsd },
    }),
  });
  const body = (await response.json().catch(() => ({}))) as LoootRun & { topUp?: { dashboardUrl?: string } };
  if (!response.ok) {
    const message = body.error?.message ?? `looot answered HTTP ${response.status}`;
    if (response.status === 401) {
      throw new LoootError('The looot agent token is not valid. Replace it in the looot app settings.', 'unauthorized');
    }
    if (response.status === 402) {
      throw new LoootError(
        `${message} Nothing was charged. Top up at ${body.topUp?.dashboardUrl ?? 'https://looot.ai'}`,
        'insufficient_balance',
      );
    }
    throw new LoootError(message, body.error?.code ?? 'looot_error');
  }
  if (['failed', 'blocked', 'stopped'].includes(body.status)) {
    throw new LoootError(
      `looot run ${body.runId} ended ${body.status}: ${body.error?.message ?? 'no message'}`,
      body.error?.code ?? `run_${body.status}`,
    );
  }
  return body;
};

/** The run facts every action returns: id, status, cost and the provider that answered. */
export const summarizeRun = (run: LoootRun): LoootRunSummary => ({
  runId: run.runId,
  status: run.status,
  costUsd: run.actualCost ?? 0,
  provider: run.servedProviderId ?? null,
});

/** Reads one normalized field as a string, or null when the provider has no field map. */
export const readField = (run: LoootRun, name: string): string | null => {
  const value = run.normalized?.fields?.[name];
  if (value === null || value === undefined || value === '') return null;
  return String(value);
};
