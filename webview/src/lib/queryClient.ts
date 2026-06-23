import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient for the webview.
 *
 * Data-fetching strategy: the backend pushes change events (e.g.
 * `SETTINGS_CHANGED`, `CLAUDE_SETTINGS_CHANGED`) over the bridge, so caches are
 * invalidated/updated reactively rather than by time- or focus-based refetch.
 * Hence `staleTime: Infinity` and focus/reconnect refetch are disabled here;
 * individual queries that genuinely need focus refetch (e.g. auth status) opt
 * back in per-hook.
 *
 * The single shared client is what makes Context the single data source: any
 * number of consumers reading the same queryKey share one in-flight request and
 * one cache entry, so duplicate backend requests cannot fan out as the UI grows.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 2,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
    },
  },
});
