import { useCallback, useState } from 'react'
export interface Activity { id: string; timestamp: string; action: string; detail?: string }
export const timestamp = (date = new Date()) => new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'medium' }).format(date)
export function useActivity() {
  const [activities, setActivities] = useState<Activity[]>([])
  const log = useCallback((action: string, detail?: string) => setActivities(items => [...items, { id: crypto.randomUUID(), timestamp: timestamp(), action, detail }]), [])
  return { activities, log }
}
