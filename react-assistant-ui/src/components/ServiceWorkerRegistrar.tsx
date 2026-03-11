'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(() => console.debug('Service worker registered for AI_OS_V3'))
        .catch((err) => console.debug('Service worker registration failed', err));
    }
  }, []);
  return null;
}
