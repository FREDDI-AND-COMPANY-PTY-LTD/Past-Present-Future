let messages = [];
const listeners = new Set();

// A pending prompt lets another part of the app (e.g. the admin proposals
// queue) hand a pre-filled question to the assistant chat box — it opens the
// panel and seeds the input so the admin can review and send it.
let pendingPrompt = null;
const promptListeners = new Set();

export function setPendingPrompt(prompt) {
  pendingPrompt = prompt || null;
  promptListeners.forEach((l) => l(pendingPrompt));
}

export function consumePendingPrompt() {
  const p = pendingPrompt;
  pendingPrompt = null;
  return p;
}

export function subscribePrompt(listener) {
  promptListeners.add(listener);
  listener(pendingPrompt);
  return () => promptListeners.delete(listener);
}

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