export type WebhookEventType =
  | 'miniapp_added'
  | 'miniapp_removed'
  | 'notifications_enabled'
  | 'notifications_disabled'

export interface NotificationDetails {
  url: string
  token: string
}

export interface TokenRecord {
  id: number
  fid: number
  token: string
  notification_url: string
  status: 'active' | 'disabled' | 'removed'
  created_at: string
  updated_at: string
}

export interface SendNotificationRequest {
  notificationId: string
  title: string
  body: string
  targetUrl: string
  tokens: string[]
}

export interface SendNotificationResponse {
  result: {
    successfulTokens: string[]
    invalidTokens: string[]
    rateLimitedTokens: string[]
  }
}
