const R = '\x1b[0m'
const B = '\x1b[1m'

/** Log notification flow messages (ingest, send, SSE broadcast) — cyan */
export function logNotify(label: string, ...args: unknown[]) {
  console.log(`\x1b[36m◆ NOTIFY\x1b[0m ${B}${label}${R}`, ...args)
}

/** Log webhook & token lifecycle messages (miniapp added/removed, token registration) — magenta */
export function logWebhook(label: string, ...args: unknown[]) {
  console.log(`\x1b[35m◆ WEBHOOK\x1b[0m ${B}${label}${R}`, ...args)
}
