import { LOCK_TTL_MS } from './constants.js';

export function lockKey(tabId) {
  return `lock:${tabId}`;
}

export async function acquireLock(tabId) {
  const key = lockKey(tabId);
  const now = Date.now();
  const data = await chrome.storage.session.get(key);
  const existing = data[key];
  if (existing && typeof existing.at === 'number' && now - existing.at < LOCK_TTL_MS) {
    return false;
  }
  await chrome.storage.session.set({ [key]: { at: now } });
  return true;
}

export async function releaseLock(tabId) {
  await chrome.storage.session.remove(lockKey(tabId));
}
