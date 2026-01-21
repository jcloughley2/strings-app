export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Helper to get a cookie value by name
function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const part = parts.pop();
    if (part) return part.split(';').shift();
  }
  return undefined;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const csrfToken = getCookie('csrftoken');
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
      ...(options.headers || {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  
  // Handle empty responses (like DELETE operations)
  const contentType = res.headers.get('content-type');
  if (res.status === 204 || !contentType?.includes('application/json')) {
    return null;
  }
  
  // Check if response has content
  const text = await res.text();
  if (!text.trim()) {
    return null;
  }
  
  return JSON.parse(text);
} 