export function resolveApiBase() {
  if (typeof window === 'undefined' || !window.location) return 'http://localhost:8000';

  const envBase = process.env.NEXT_PUBLIC_API_BASE;
  if (envBase) return String(envBase).replace(/\/+$/, '');

  // Next dev server commonly runs on 3000 or a custom port; backend is expected on 8000.
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    if (window.location.port === '3000' || window.location.port === '5174') return 'http://localhost:8000';
  }

  return window.location.origin;
}

