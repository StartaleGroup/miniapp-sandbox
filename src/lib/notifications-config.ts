const EMULATOR_URL =
	"http://127.0.0.1:5001/miniapp-notifications/us-central1/notifications";

export const NOTIFICATIONS_BASE_URL: string =
	import.meta.env.VITE_NOTIFICATIONS_URL || EMULATOR_URL;
export const NOTIFICATIONS_API_KEY: string =
	import.meta.env.VITE_NOTIFICATIONS_API_KEY || "test-sandbox-key";

export const NOTIFICATION_INGEST_URL = `${NOTIFICATIONS_BASE_URL}/v1/notifications`;
export const WEBHOOK_URL = `${NOTIFICATIONS_BASE_URL}/webhook`;
export const SENT_NOTIFICATIONS_URL = `${NOTIFICATIONS_BASE_URL}/v1/notifications/sent`;
