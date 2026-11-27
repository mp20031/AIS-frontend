import { API_URL } from './helpers'

const WAIT_MS = 30_000

const answers = (url: string) =>
  fetch(url).then(
    (response) => response.ok,
    () => false,
  )

/**
 * Fail once, clearly, instead of every test timing out on a stack that isn't
 * up. Waits a little first: right after `docker compose up` the containers
 * take a few seconds to start answering.
 */
export default async function globalSetup() {
  const portal = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
  for (const [name, url] of [
    ['iam-api', `${API_URL}/health`],
    ['portal', portal],
  ]) {
    const deadline = Date.now() + WAIT_MS
    while (!(await answers(url))) {
      if (Date.now() > deadline) {
        throw new Error(`${name} is not answering at ${url}. Start the stack first: docker compose up -d --build`)
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}
