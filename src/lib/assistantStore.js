let messages = [];
const listeners = new Set();

export function getMessages() {
  return messages;
}

export function setMessages(updater) {
  messages = typeof updater === 'function' ? updater(messages) : updater;
  listeners.forEach(l => l([...messages]));
}

export function subscribe(listener) {
  listeners.add(listener);
  listener([...messages]);
  return () => listeners.delete(listener);
}