import { useQuery } from '@tanstack/react-query';
import { useBridge } from './useBridge';
import { MessageType, McpRegistryServer } from '@/shared';

export interface UseMcpRegistryReturn {
  servers: McpRegistryServer[];
  nextCursor: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Search the official MCP registry. Disabled until `query` is non-empty so an
 * empty search box does not fire a request. Results are cached per query.
 */
export function useMcpRegistry(query: string): UseMcpRegistryReturn {
  const { send } = useBridge();
  const trimmed = query.trim();

  const { data, isFetching, error: queryError } = useQuery({
    queryKey: ['mcp-registry', trimmed],
    queryFn: async () => {
      const res = await send<{
        status: string;
        servers?: McpRegistryServer[];
        nextCursor?: string | null;
        error?: string;
      }>(MessageType.SEARCH_MCP_REGISTRY, { query: trimmed });
      if (res.status === 'ok') {
        return { servers: res.servers ?? [], nextCursor: res.nextCursor ?? null };
      }
      throw new Error(res.error ?? 'Failed to search the MCP registry');
    },
    enabled: trimmed.length > 0,
    staleTime: 60 * 1000,
    retry: false,
  });

  const error =
    queryError instanceof Error ? queryError.message : queryError != null ? String(queryError) : null;

  return {
    servers: data?.servers ?? [],
    nextCursor: data?.nextCursor ?? null,
    loading: isFetching,
    error,
  };
}

/**
 * Convert a registry entry into pre-filled values for the Add form.
 * The reverse-DNS name (e.g. "io.github.acme/widget") is shortened to its last
 * path segment as a sensible default the user can edit; the config is stringified
 * as the JSON the smart parser will read back.
 */
export function registryServerToPrefill(server: McpRegistryServer): { name: string; json: string } {
  const name = server.name.split('/').pop() || server.name;
  const json = server.config ? JSON.stringify(server.config, null, 2) : '';
  return { name, json };
}
