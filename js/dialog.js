// In-page dialogs instead of the browser's confirm(), which looks out of place and misbehaves on some Chromebooks.
import { esc } from './util.js';

/** Resolves true when the person presses the main button, false on cancel or Esc. */
export function ask(message, { ok = 'OK', cancel = 'Cancel', danger = false, title = '' } = {}) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dlg';
    d.innerHTML = `<form method="dialog">
      ${title ? `<h2>${esc(title)}</h2>` : ''}
      <p>${esc(message).replace(/\n/g, '<br>')}</p>
      <div class="dlg-actions"><button class="btn" value="cancel">${esc(cancel)}</button><button class="btn ${danger ? 'danger-solid' : 'primary'}" value="ok">${esc(ok)}</button></div>
    </form>`;
    document.body.append(d);
    d.addEventListener('close', () => {
      resolve(d.returnValue === 'ok');
      d.remove();
    });
    d.addEventListener('click', (e) => e.target === d && d.close('cancel')); // click on the backdrop
    d.showModal();
    d.querySelector('[value="ok"]').focus();
  });
}
