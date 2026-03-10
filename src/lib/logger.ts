/** Log Farcaster host protocol messages (frame events, comlink, provider) — blue */
export function logFarcaster(label: string, ...args: unknown[]) {
  console.log(
    `%c[FC]%c ${label}`,
    'background:#1d4ed8;color:#fff;padding:1px 5px;border-radius:3px;font-weight:bold',
    'color:inherit',
    ...args,
  )
}

/** Log Notify server communication messages from the host — purple */
export function logNotify(label: string, ...args: unknown[]) {
  console.log(
    `%c[NOTIFY]%c ${label}`,
    'background:#7c3aed;color:#fff;padding:1px 5px;border-radius:3px;font-weight:bold',
    'color:inherit',
    ...args,
  )
}
