/**
 * The backend issues a pairing URL of the form `<tunnelOrigin>/?pair=<code>` —
 * root path only. Rebuild it onto the desktop's CURRENT location (path + query +
 * hash) so a device scanning the QR lands on the SAME session the user is
 * viewing, not the project-list root.
 *
 * The single-use pairing code is preserved; any `token`/`pair` already present in
 * the local URL is dropped first — the per-launch auth token must NEVER travel in
 * the QR (only the short-lived pairing code may). Session path/`workingDir` are
 * not secrets, so carrying them does not weaken the pairing gate.
 *
 * Pure function (takes the current href explicitly) so it is trivially testable.
 * Falls back to the backend URL unchanged if either input is not a valid URL.
 */
export function buildRemotePairUrl(backendPairUrl: string, currentHref: string): string {
  try {
    const fromBackend = new URL(backendPairUrl);
    const code = fromBackend.searchParams.get('pair');
    const local = new URL(currentHref);
    local.searchParams.delete('token');
    local.searchParams.delete('pair');
    if (code) local.searchParams.set('pair', code);
    return fromBackend.origin + local.pathname + local.search + local.hash;
  } catch {
    return backendPairUrl;
  }
}
