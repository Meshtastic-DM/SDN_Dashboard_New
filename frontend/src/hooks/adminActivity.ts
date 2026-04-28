type AdminActivityListener = (isAdminActive: boolean) => void;

const listeners = new Set<AdminActivityListener>();
let activeAdminRequestCount = 0;

function notify() {
  const isAdminActive = activeAdminRequestCount > 0;
  listeners.forEach((listener) => listener(isAdminActive));
}

export function subscribeAdminActivity(listener: AdminActivityListener) {
  listeners.add(listener);
  listener(activeAdminRequestCount > 0);

  return () => {
    listeners.delete(listener);
  };
}

export async function trackedAdminFetch(input: RequestInfo | URL, init?: RequestInit) {
  activeAdminRequestCount += 1;
  notify();

  try {
    return await fetch(input, init);
  } finally {
    activeAdminRequestCount = Math.max(0, activeAdminRequestCount - 1);
    notify();
  }
}
