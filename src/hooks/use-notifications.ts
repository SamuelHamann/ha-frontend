export interface AppNotification {
  id: string;
  title: string;
  detail?: string;
}

/**
 * Placeholder — not wired to a real alert source yet, so it always returns an empty list.
 * Once there's something to alert on (Home Assistant persistent_notifications, connection
 * errors, etc.), return real entries here; the length drives the bell's red highlight.
 */
export function useNotifications(): { notifications: AppNotification[]; count: number } {
  return { notifications: [], count: 0 };
}
