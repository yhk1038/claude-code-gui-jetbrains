import { useSessionContext } from '../contexts/SessionContext';

/**
 * @deprecated Use useSessionContext directly for better clarity.
 * This hook is kept for backward compatibility.
 */
export function useSession() {
  return useSessionContext();
}
