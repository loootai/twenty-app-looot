import { RestApiClient } from 'twenty-client-sdk/rest';
import { CommandModal, enqueueSnackbar, useSelectedRecordIds } from 'twenty-sdk/front-component';

import { MAX_RECORDS_PER_CLICK } from 'src/constants/universal-identifiers';
import { summarizeResults, type ClickResult } from 'src/lib/summary';

type EnrichRecordsProps = {
  /** The app route to call for each record, without the /s prefix. */
  route: string;
  title: string;
  subtitle: string;
};

/** Asks for confirmation, then calls the app route once per selected record and reports the totals. */
export const EnrichRecords = ({ route, title, subtitle }: EnrichRecordsProps) => {
  const selectedRecordIds = useSelectedRecordIds();
  const recordIds = selectedRecordIds.slice(0, MAX_RECORDS_PER_CLICK);

  const execute = async () => {
    const client = new RestApiClient();
    const results: ClickResult[] = [];
    for (const recordId of recordIds) {
      try {
        results.push(await client.post<ClickResult>(`/s${route}`, { recordId }));
      } catch (error) {
        results.push({ outcome: 'error', message: error instanceof Error ? error.message : String(error), run: null });
      }
    }
    const summary = summarizeResults(results, selectedRecordIds.length);
    await enqueueSnackbar({ message: summary.message, variant: summary.variant });
  };

  if (recordIds.length === 0) return null;

  return (
    <CommandModal
      title={title}
      subtitle={`${subtitle} ${recordIds.length} record${recordIds.length === 1 ? '' : 's'} selected${
        selectedRecordIds.length > MAX_RECORDS_PER_CLICK ? `, the first ${MAX_RECORDS_PER_CLICK} will run` : ''
      }.`}
      execute={execute}
      confirmButtonText="Run"
    />
  );
};
