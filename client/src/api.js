// One place that talks to the server. Every page uses api("/path", { method, body }).
const TOKEN_KEY = 'bl_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken()
  const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // An expired token while logged in sends the person back to the login page
    if (res.status === 401 && token) {
      clearToken()
      window.dispatchEvent(new Event('bl-unauthorized'))
    }
    throw new Error(data.error || 'Something went wrong. Please try again.')
  }
  return data
}
