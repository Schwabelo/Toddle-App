// Shared UI plumbing: action registry, re-render hook, toasts.

export const actions = {}; // data-action="name" (click)
export const changes = {}; // data-change="name" (change)
export const inputs = {}; // data-input="name" (input)

let renderFn = () => {};
export const setRender = (f) => (renderFn = f);
export const rerender = () => renderFn();

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
