/**
 * Where the session lives in this browser.
 *
 * "Keep me signed in" puts it in localStorage, which survives closing the
 * browser; otherwise it goes in sessionStorage, which the browser clears when
 * the tab closes.
 *
 * What is stored here is only the short-lived access token. The session itself
 * lives in iam-api's httpOnly refresh cookie, which this code never sees: the
 * same choice makes that cookie outlive the browser or not, and when the access
 * token expires, `refreshAccessToken` gets a new one from it.
 *
 * Reads check both stores, so callers never need to know which one was used.
 */
export const authStorage = {
  get(key: string): string | null {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key)
  },

  set(key: string, value: string, persistent: boolean): void {
    // Clear both first, so a previous login with the other choice can't linger.
    this.remove(key)
    ;(persistent ? localStorage : sessionStorage).setItem(key, value)
  },

  /**
   * Overwrite a value in whichever store already holds it, so a refreshed
   * token keeps the user's "keep me signed in" choice. With nothing stored
   * yet (a new tab restoring its session), it goes to sessionStorage.
   */
  replace(key: string, value: string): void {
    this.set(key, value, localStorage.getItem(key) !== null)
  },

  remove(key: string): void {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}
