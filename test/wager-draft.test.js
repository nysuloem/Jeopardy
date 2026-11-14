const test = require('node:test');
const assert = require('node:assert/strict');
const {wireFinalWager} = require('../public/wager-draft');

function form() {
  const input = Object.assign(new EventTarget(), {value: '', focus() {this.focused = true;}});
  const button = {disabled: false};
  return Object.assign(new EventTarget(), {input, button, querySelector: selector => selector === 'input' ? input : button});
}

test('other wagers and reconnect renders preserve a private unfinished draft, including zero', () => {
  const values = new Map(), storage = {getItem: key => values.get(key), setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key)};
  let reply;
  const setup = (key, focus = false) => {
    const node = form();
    wireFinalWager({form: node, storage, key, focus, submit: (_amount, callback) => {reply = callback;}, error: () => {}});
    return node;
  };
  const key = 'room-A:stable-player-token', first = setup(key);
  first.input.value = '1200'; first.input.dispatchEvent(new Event('input'));
  const secondPlayer = setup('room-A:other-player');
  assert.equal(secondPlayer.input.value, '');
  // A room broadcast destroys the old form and creates a fresh one.
  const next = setup(key, true);
  assert.equal(next.input.value, '1200'); assert.equal(next.input.focused, true);
  next.input.value = '0'; next.input.dispatchEvent(new Event('input'));
  const reconnected = setup(key);
  assert.equal(reconnected.input.value, '0');
  reconnected.dispatchEvent(new Event('submit', {cancelable: true}));
  assert.equal(reconnected.button.disabled, true);
  reply({ok: false});
  assert.equal(reconnected.button.disabled, false); assert.equal(setup(key).input.value, '0');
  reconnected.dispatchEvent(new Event('submit', {cancelable: true})); reply({ok: true});
  assert.equal(setup(key).input.value, '');
  assert.equal(setup('room-B:stable-player-token').input.value, '');
});
