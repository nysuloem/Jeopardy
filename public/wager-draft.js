(function (root) {
  'use strict';
  function wireFinalWager({ form, storage, key, submit, error, focus = false }) {
    const input = form.querySelector('input'), button = form.querySelector('button');
    const read = () => { try { return storage.getItem(key) || ''; } catch { return ''; } };
    const write = () => { try { storage.setItem(key, input.value); } catch {} };
    const clear = () => { try { storage.removeItem(key); } catch {} };
    input.value = read();
    input.addEventListener('input', write);
    if (focus) input.focus({ preventScroll: true });
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (button.disabled) return;
      write();
      button.disabled = true;
      submit(input.value, result => {
        if (result?.ok) clear();
        else { button.disabled = false; error(result?.error || 'Please try your wager again.'); }
      });
    });
  }
  root.wireFinalWager = wireFinalWager;
  if (typeof module !== 'undefined') module.exports = { wireFinalWager };
})(typeof window !== 'undefined' ? window : globalThis);
