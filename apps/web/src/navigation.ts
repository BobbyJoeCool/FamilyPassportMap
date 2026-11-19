/**
 * Leaves the current page with a full page load (not a router navigation), so nothing from the
 * old page, such as a signed-out session's data, stays in memory. Kept in its own module so unit
 * tests can replace it: jsdom can't navigate, and `window.location` can't be spied on.
 * @param url - the in-app path (or URL) to load.
 */
export function loadPage(url: string): void {
  window.location.assign(url);
}
