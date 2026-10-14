export type OnboardingIntent = 'solo' | 'friends' | 'trips'

type OnboardingKey = 'welcome' | 'checklist' | 'intent'

function storageKey(uid: string, key: OnboardingKey) {
  return `ft:onboard:${uid}:${key}`
}

export function readOnboarding(uid: string | undefined, key: OnboardingKey): string | null {
  if (!uid || typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(storageKey(uid, key))
  } catch {
    return null
  }
}

export function writeOnboarding(uid: string | undefined, key: OnboardingKey, value: string) {
  if (!uid || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(uid, key), value)
    window.dispatchEvent(new CustomEvent('ft:onboarding'))
  } catch {
    /* storage full or blocked — onboarding simply shows again */
  }
}

export function readIntent(uid: string | undefined): OnboardingIntent | null {
  const value = readOnboarding(uid, 'intent')
  return value === 'solo' || value === 'friends' || value === 'trips' ? value : null
}
