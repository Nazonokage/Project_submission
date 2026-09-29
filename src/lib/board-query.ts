'use client';
import { useIsMutating, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { boardKeys } from '@/lib/query-keys';

export async function boardJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not load board');
  return data;
}
export function useBoardQuery<T>(key: QueryKey, url: string, enabled = true, mutationKey: QueryKey = key) {
  const pending = useIsMutating({ mutationKey });
  return useQuery<T>({ queryKey: key, queryFn: ({ signal }) => boardJson<T>(url, signal), enabled: enabled && !pending,
    // Vercel-friendly polling: one cache, no background requests in hidden windows.
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}
// Capture the affected title in mutation variables, even if the user switches titles mid-request.
export function useBoardRequest(titleId: string) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: boardKeys.title('student', titleId),
    scope: { id: `student-board:${titleId}` },
    mutationFn: async ({ url, init }: { url: string; init: RequestInit; titleId: string }) => {
      const res = await fetch(url, init);
      if (!res.ok) { const data = await res.clone().json().catch(() => ({})); throw new Error(data.error || 'Could not save board change'); }
      return res;
    },
    onMutate: ({ titleId }) => client.cancelQueries({ queryKey: boardKeys.title('student', titleId) }),
    onSettled: (_data, _error, { titleId }) => client.invalidateQueries({ queryKey: boardKeys.title('student', titleId) }),
  });
  return (url: string, init: RequestInit) => mutation.mutateAsync({ url, init, titleId });
}
