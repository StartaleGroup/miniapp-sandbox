export const config = {
  port: Number(process.env.NOTIFY_PORT ?? 3200),
  dbPath: process.env.NOTIFY_DB_PATH ?? './data/notify.db',
}
