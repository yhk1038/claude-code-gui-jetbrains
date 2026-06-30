import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useBridge } from './useBridge';
import { MessageType, McpServer, McpServerStatus } from '@/shared';

export const MCP_SERVERS_QUERY_KEY = ['mcp-servers'] as const;

interface McpServersData {
  servers: McpServer[];
  configPath?: string;
}

export interface UseMcpServersReturn {
  servers: McpServer[];
  /** Display path of the global config file (~/.claude.json or $CLAUDE_CONFIG_DIR/.claude.json). */
  configPath?: string;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  reconnect: (name: string) => Promise<McpServer | null>;
  setEnabled: (name: string, enabled: boolean) => Promise<void>;
  addServer: (name: string, config: Record<string, unknown>, scope: string) => Promise<void>;
  removeServer: (name: string, scope: string) => Promise<void>;
  authenticate: (name: string) => Promise<{ hint?: string }>;
  clearAuth: (name: string) => Promise<{ hint?: string }>;
}

export function useMcpServers(): UseMcpServersReturn {
  const { send } = useBridge();
  const queryClient = useQueryClient();

  const { data, isPending: loading, isFetching: refreshing, error: queryError } = useQuery({
    queryKey: MCP_SERVERS_QUERY_KEY,
    queryFn: async (): Promise<McpServersData> => {
      const res = await send<{ status: string; servers?: McpServer[]; configPath?: string; error?: string }>(
        MessageType.GET_MCP_SERVERS,
      );
      if (res.status === 'ok' && res.servers) {
        return { servers: res.servers, configPath: res.configPath };
      }
      throw new Error(res.error ?? 'Failed to load MCP servers');
    },
    // MCP 서버 상태는 런타임에 변경되므로 stale=0 — gcTime 내에선 캐시 즉시 표시 후 백그라운드 refresh
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });

  const servers = data?.servers ?? [];
  const configPath = data?.configPath;
  const error = queryError instanceof Error ? queryError.message : (queryError != null ? String(queryError) : null);

  const invalidate = useCallback(
    async () => { await queryClient.invalidateQueries({ queryKey: MCP_SERVERS_QUERY_KEY }); },
    [queryClient],
  );

  const reconnectMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await send<{ status: string; server?: McpServer; error?: string }>(
        MessageType.RECONNECT_MCP_SERVER,
        { name },
      );
      return res.server ?? null;
    },
    onSuccess: () => { void invalidate(); },
  });

  const setEnabledMutation = useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: boolean }) => {
      await send(MessageType.SET_MCP_SERVER_ENABLED, { name, enabled });
    },
    // Optimistically reflect the toggle: a full refetch re-runs every server's
    // health check (seconds), so without this the list/detail looks stale until
    // it completes. onSettled re-syncs with the backend's real status.
    onMutate: async ({ name, enabled }) => {
      await queryClient.cancelQueries({ queryKey: MCP_SERVERS_QUERY_KEY });
      const previous = queryClient.getQueryData<McpServersData>(MCP_SERVERS_QUERY_KEY);
      queryClient.setQueryData<McpServersData>(MCP_SERVERS_QUERY_KEY, (old) =>
        old
          ? {
              ...old,
              servers: old.servers.map((s) =>
                s.name === name
                  ? {
                      ...s,
                      status: enabled ? McpServerStatus.PENDING : McpServerStatus.DISABLED,
                      error: enabled ? s.error : null,
                    }
                  : s,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(MCP_SERVERS_QUERY_KEY, ctx.previous);
    },
    onSettled: () => { void invalidate(); },
  });

  const addServerMutation = useMutation({
    mutationFn: async ({ name, config, scope }: { name: string; config: Record<string, unknown>; scope: string }) => {
      const res = await send<{ status: string; error?: string }>(MessageType.ADD_MCP_SERVER, { name, config, scope });
      if (res.status !== 'ok') throw new Error(res.error ?? 'Failed to add MCP server');
    },
    onSuccess: () => { void invalidate(); },
  });

  const removeServerMutation = useMutation({
    mutationFn: async ({ name, scope }: { name: string; scope: string }) => {
      const res = await send<{ status: string; error?: string }>(MessageType.REMOVE_MCP_SERVER, { name, scope });
      if (res.status !== 'ok') throw new Error(res.error ?? 'Failed to remove MCP server');
    },
    onSuccess: () => { void invalidate(); },
  });

  const authenticateMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await send<{ status: string; hint?: string }>(MessageType.AUTHENTICATE_MCP_SERVER, { name });
      return { hint: res.hint };
    },
  });

  const clearAuthMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await send<{ status: string; hint?: string }>(MessageType.CLEAR_MCP_SERVER_AUTH, { name });
      return { hint: res.hint };
    },
  });

  return {
    servers,
    configPath,
    loading,
    refreshing,
    error,
    fetch: invalidate,
    reconnect: (name) => reconnectMutation.mutateAsync(name),
    setEnabled: (name, enabled) => setEnabledMutation.mutateAsync({ name, enabled }),
    addServer: (name, config, scope) => addServerMutation.mutateAsync({ name, config, scope }),
    removeServer: (name, scope) => removeServerMutation.mutateAsync({ name, scope }),
    authenticate: (name) => authenticateMutation.mutateAsync(name),
    clearAuth: (name) => clearAuthMutation.mutateAsync(name),
  };
}
