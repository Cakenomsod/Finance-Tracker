import { auth } from '@/lib/firebase'

/** Attach a fresh Firebase ID token for API routes that use verifySession(). */
export async function getAuthHeaders(
  extra?: HeadersInit
): Promise<Headers> {
  const headers = new Headers(extra)
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    headers.set('Authorization', `Bearer ${token}`)
  }
  return headers
}

/** fetch() with Bearer token + same-origin cookies (session cookie stays in sync). */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = await getAuthHeaders(init?.headers)
  return fetch(input, {
    ...init,
    headers,
    credentials: init?.credentials ?? 'same-origin',
  })
}

async function postSessionCookie(idToken: string): Promise<void> {
  await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ idToken }),
  })
}

/** Keep __session cookie aligned with Firebase token refresh (tokens expire ~1h). */
export function startSessionCookieSync(): () => void {
  const refreshFromCurrentUser = async () => {
    const user = auth.currentUser
    if (!user) return
    try {
      const idToken = await user.getIdToken()
      await postSessionCookie(idToken)
    } catch (error) {
      console.error('[Auth] session cookie refresh failed:', error)
    }
  }

  const onFocus = () => {
    void refreshFromCurrentUser()
  }

  window.addEventListener('focus', onFocus)
  void refreshFromCurrentUser()

  return () => {
    window.removeEventListener('focus', onFocus)
  }
}
