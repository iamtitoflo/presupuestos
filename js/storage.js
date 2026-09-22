import { DEFAULT_STATE, STORAGE_KEY, normalizeState } from './state.js';

const DB_NAME = 'presupuestos_app';
const DB_VERSION = 1;
const STATE_KEY = 'current';

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Error de IndexedDB'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar'));
    transaction.onabort = () => reject(transaction.error || new Error('Guardado cancelado'));
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('app')) db.createObjectStore('app');
      if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB no está disponible'));
  });
}

function legacyPayload() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { raw, invalid: true };
    return { raw, state: normalizeState(parsed) };
  } catch {
    return { raw, invalid: true };
  }
}

export async function createStorage() {
  let db;
  let fallback = false;

  try {
    db = await openDatabase();
  } catch (error) {
    console.error('IndexedDB no disponible; se usa almacenamiento de compatibilidad', error);
    fallback = true;
  }

  async function putBackup(state, reason) {
    if (fallback) return null;
    const record = {
      id: `${Date.now()}-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      reason,
      state: structuredClone(state)
    };
    const tx = db.transaction('backups', 'readwrite');
    tx.objectStore('backups').put(record);
    await transactionDone(tx);
    return record;
  }

  async function readCurrent() {
    const tx = db.transaction('app', 'readonly');
    const value = await requestAsPromise(tx.objectStore('app').get(STATE_KEY));
    await transactionDone(tx);
    return value;
  }

  async function writeCurrent(state) {
    const normalized = normalizeState(state);
    const tx = db.transaction('app', 'readwrite');
    tx.objectStore('app').put(normalized, STATE_KEY);
    await transactionDone(tx);
    const verified = await readCurrent();
    if (JSON.stringify(verified) !== JSON.stringify(normalized)) {
      throw new Error('No se pudo verificar el guardado');
    }
    return normalized;
  }

  async function getPersistenceStatus() {
    if (!navigator.storage?.persisted) return { supported: false, persisted: false };
    const persisted = await navigator.storage.persisted();
    return { supported: true, persisted };
  }

  async function requestPersistence() {
    if (!navigator.storage?.persist) return { supported: false, persisted: false };
    const persisted = await navigator.storage.persist();
    return { supported: true, persisted };
  }

  async function init() {
    if (fallback) {
      const legacy = legacyPayload();
      return { state: legacy?.state || structuredClone(DEFAULT_STATE), migrated: false, legacyCorrupt: !!legacy?.invalid, fallback: true, persistence: { supported: false, persisted: false } };
    }
    const existing = await readCurrent();
    if (existing) {
      return { state: normalizeState(existing), migrated: false, legacyCorrupt: false, fallback: false, persistence: await requestPersistence() };
    }

    const legacy = legacyPayload();
    const state = legacy?.state || structuredClone(DEFAULT_STATE);
    if (legacy) {
      // The old key is intentionally never removed.  This transaction creates
      // a recoverable snapshot before promoting the data to IndexedDB.
      await putBackup(state, legacy.invalid ? 'legacy-invalid-raw-copy' : 'legacy-migration');
    }
    await writeCurrent(state);
    return { state, migrated: !!legacy?.state, legacyCorrupt: !!legacy?.invalid, fallback: false, persistence: await requestPersistence() };
  }

  async function save(state, { countAsChange = true } = {}) {
    if (fallback) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return normalizeState(state);
    }
    const next = normalizeState(state);
    if (countAsChange) next.backup.changesSinceExternalBackup = (Number(next.backup.changesSinceExternalBackup) || 0) + 1;
    return writeCurrent(next);
  }

  async function replaceFromImport(importedState) {
    if (fallback) {
      const current = legacyPayload()?.state || structuredClone(DEFAULT_STATE);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(importedState));
      return { state: normalizeState(importedState), backup: current };
    }
    const current = await readCurrent();
    if (current) await putBackup(normalizeState(current), 'before-import');
    const state = await writeCurrent(importedState);
    return { state, backup: current };
  }

  async function createRecoveryBackup(state, reason = 'manual') {
    if (fallback) return null;
    return putBackup(normalizeState(state), reason);
  }

  return { init, save, replaceFromImport, createRecoveryBackup, getPersistenceStatus, fallback };
}
