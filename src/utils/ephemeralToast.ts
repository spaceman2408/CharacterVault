/**
 * Lightweight app-level toasts that don't need React state / prop drilling.
 * Styled to match CharacterWorkspace toasts.
 */

export type EphemeralToastType = 'success' | 'info' | 'error';

export interface EphemeralToastOptions {
  type?: EphemeralToastType;
  title: string;
  message?: string;
  durationMs?: number;
}

const HOST_ID = 'cv-ephemeral-toast-host';

function ensureHost(): HTMLElement {
  let host = document.getElementById(HOST_ID);
  if (host) return host;

  host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('aria-live', 'polite');
  host.className =
    'pointer-events-none fixed right-4 bottom-4 z-100 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2';
  document.body.appendChild(host);
  return host;
}

function typeClasses(type: EphemeralToastType): { shell: string; icon: string } {
  if (type === 'error') {
    return {
      shell:
        'border-danger/40 bg-danger-soft text-danger-soft-fg',
      icon: 'bg-danger-soft text-danger-soft-fg',
    };
  }
  if (type === 'info') {
    return {
      shell:
        'border-warning/40 bg-warning-soft text-warning-soft-fg',
      icon: 'bg-warning-soft text-warning-soft-fg',
    };
  }
  return {
    shell:
      'border-success/40 bg-success-soft text-success-soft-fg',
    icon: 'bg-success-soft text-success-soft-fg',
  };
}

/**
 * Show a short-lived toast in the bottom-right corner.
 */
export function showEphemeralToast(options: EphemeralToastOptions): void {
  if (typeof document === 'undefined') return;

  const type = options.type ?? 'success';
  const durationMs = options.durationMs ?? 2800;
  const { shell, icon } = typeClasses(type);
  const host = ensureHost();

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ring-1 ring-black/5 transition-all duration-300 animate-in slide-in-from-right backdrop-blur-sm ${shell}`;
  toast.setAttribute('role', 'status');

  const iconWrap = document.createElement('div');
  iconWrap.className = `mt-0.5 rounded-full p-1 ${icon}`;
  iconWrap.innerHTML =
    type === 'success'
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';

  const body = document.createElement('div');
  body.className = 'min-w-0 flex-1';

  const title = document.createElement('p');
  title.className = 'text-sm font-semibold';
  title.textContent = options.title;
  body.appendChild(title);

  if (options.message) {
    const message = document.createElement('p');
    message.className = 'text-sm opacity-90';
    message.textContent = options.message;
    body.appendChild(message);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'rounded p-1 hover:bg-hover';
  close.setAttribute('aria-label', 'Dismiss');
  close.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(0.5rem)';
    window.setTimeout(() => {
      toast.remove();
      if (host.childElementCount === 0) host.remove();
    }, 200);
  };

  close.addEventListener('click', dismiss);

  toast.appendChild(iconWrap);
  toast.appendChild(body);
  toast.appendChild(close);
  host.appendChild(toast);

  window.setTimeout(dismiss, durationMs);
}
