import { useCallback } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useBridgeContext } from '@/contexts/BridgeContext';
import { useWorkingDir } from '@/contexts/WorkingDirContext';
import { MessageType } from '@/shared';
import { parseUsageReport, type UsageReport } from '@/components/AccountUsageModal/parseUsageReport';

interface RawUsageReportResponse {
  status?: string;
  report?: string | null;
  error?: string | null;
}

export interface UsageReportResult {
  status: string;
  report: UsageReport | null;
  error: string | null;
}

function normalize(res: RawUsageReportResponse): UsageReportResult {
  const text = typeof res?.report === 'string' ? res.report : '';
  const ok = res?.status === 'ok' && text.trim().length > 0;
  return {
    status: res?.status ?? 'error',
    report: ok ? parseUsageReport(text) : null,
    error: ok ? null : (res?.error ?? 'Failed to load usage report'),
  };
}

/**
 * GET_USAGE_REPORT query — runs `claude -p "/usage"` on the backend and parses
 * the raw text into a {@link UsageReport}. Kept separate from useUsageQuery
 * (ccb) because the CLI spawn is slower; the modal shows session/weekly figures
 * immediately and loads this in the background.
 *
 * `enabled` gates the (expensive, usage-consuming) fetch to when the modal is
 * actually open. Keyed by workingDir so each project resolves its own profile.
 */
export type UseUsageReportResult = UseQueryResult<UsageReportResult, Error> & {
  /** Force a fresh fetch that bypasses BOTH the react-query and backend caches. */
  refresh: () => Promise<void>;
};

export function useUsageReport(enabled: boolean): UseUsageReportResult {
  const { isConnected, send } = useBridgeContext();
  const { workingDirectory } = useWorkingDir();
  const queryClient = useQueryClient();

  const query = useQuery<UsageReportResult, Error>({
    queryKey: [MessageType.GET_USAGE_REPORT, workingDirectory],
    enabled: enabled && isConnected,
    // The CLI spawn is slow and the report changes little between opens; the
    // backend also caches for 60s, so avoid hammering it on remount.
    staleTime: 60_000,
    queryFn: async () =>
      normalize(
        (await send(MessageType.GET_USAGE_REPORT, {
          force: false,
          workingDir: workingDirectory ?? undefined,
        })) as RawUsageReportResponse,
      ),
  });

  // A plain refetch() would re-run queryFn with force:false and just get the
  // backend's cached value back. Explicit refresh sends force:true (bypassing the
  // backend's 60s cache) and writes the result straight into the shared cache so
  // every consumer updates at once — mirrors useUsageData's refresh.
  const refresh = useCallback(async () => {
    const result = normalize(
      (await send(MessageType.GET_USAGE_REPORT, {
        force: true,
        workingDir: workingDirectory ?? undefined,
      })) as RawUsageReportResponse,
    );
    queryClient.setQueryData([MessageType.GET_USAGE_REPORT, workingDirectory], result);
  }, [send, workingDirectory, queryClient]);

  return { ...query, refresh };
}
