// db.js — IndexedDB persistence layer.
//
// Schema (database "ws-terms-db", version 1):
//   store "terms"  keyPath "id"
//     indexes: "category" (non-unique), "source" (non-unique)
//     Each record is a term object (see data/terms.json for the shape) plus
//     two fields IndexedDB owns that never appear in the source JSON:
//       - source:   "official" (one of the fixed 100, read-only in the UI)
//                   | "custom"   (added by this visitor, editable/deletable)
//       - favorite: boolean, toggled from the UI, persisted per term
//
// The full 100-term dataset is seeded from data/terms.json into this store
// on first run only. Every subsequent load — including fully offline
// reloads — reads straight from IndexedDB, never re-fetches the JSON file.
// localStorage is intentionally not used here: it's synchronous (blocks the
// main thread), string-only, and caps out around 5MB.

const DB_NAME = "ws-terms-db";
const DB_VERSION = 1;
const STORE_TERMS = "terms";
const TERMS_JSON_URL = "data/terms.json";

let dbPromise = null;

/** Open (or upgrade) the database. Cached so repeat calls reuse one connection. */
function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TERMS)) {
        const store = db.createObjectStore(STORE_TERMS, { keyPath: "id" });
        store.createIndex("category", "category", { unique: false });
        store.createIndex("source", "source", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/** Wrap an IDBRequest in a promise. */
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStore(db, mode) {
  return db.transaction(STORE_TERMS, mode).objectStore(STORE_TERMS);
}

/**
 * Seed the "terms" store from data/terms.json the first time the app runs.
 * No-op on every run after that, so an offline reload never needs the network.
 */
export async function seedIfNeeded() {
  const db = await openDatabase();
  const existingCount = await promisifyRequest(getStore(db, "readonly").count());
  if (existingCount > 0) return;

  const response = await fetch(TERMS_JSON_URL);
  const officialTerms = await response.json();

  const tx = db.transaction(STORE_TERMS, "readwrite");
  const store = tx.objectStore(STORE_TERMS);
  for (const term of officialTerms) {
    store.put({ ...term, source: "official", favorite: false });
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

/** Return every term (official + custom) as a plain array. */
export async function getAllTerms() {
  const db = await openDatabase();
  return promisifyRequest(getStore(db, "readonly").getAll());
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function generateCustomId(term) {
  const base = slugify(term) || "custom-term";
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `custom-${base}-${suffix}`;
}

function splitRelatedTerms(value) {
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Add a visitor-authored term. Only `term` and `category` are required;
 * everything else defaults to null/empty so it renders through the same
 * card and detail components as the official 100.
 */
export async function addCustomTerm(input) {
  const term = (input.term || "").trim();
  const category = (input.category || "").trim();
  if (!term) throw new Error("Term name is required.");
  if (!category) throw new Error("Category is required.");

  const record = {
    id: generateCustomId(term),
    term,
    category,
    pronunciation: (input.pronunciation || "").trim() || null,
    shortDefinition: (input.shortDefinition || "").trim() || null,
    extendedDefinition: (input.extendedDefinition || "").trim() || null,
    relatedTerms: splitRelatedTerms(input.relatedTerms),
    example: (input.example || "").trim() || null,
    image: input.image || null,
    antonym: null,
    source: "custom",
    favorite: false,
    createdAt: Date.now(),
  };

  const db = await openDatabase();
  await promisifyRequest(getStore(db, "readwrite").add(record));
  return record;
}

/** Fetch one term by id, or undefined if it doesn't exist. */
export async function getTermById(id) {
  const db = await openDatabase();
  return promisifyRequest(getStore(db, "readonly").get(id));
}

/**
 * Update a visitor-authored term. Refuses to touch anything whose
 * source is "official" — the fixed 100 are read-only everywhere in the UI,
 * and this guard is the last line of defense even if a caller tries anyway.
 */
export async function updateCustomTerm(id, updates) {
  const db = await openDatabase();
  const existing = await promisifyRequest(getStore(db, "readonly").get(id));
  if (!existing) throw new Error("Term not found.");
  if (existing.source !== "custom") throw new Error("Official terms cannot be edited.");

  const term = (updates.term || "").trim();
  const category = (updates.category || "").trim();
  if (!term) throw new Error("Term name is required.");
  if (!category) throw new Error("Category is required.");

  const record = {
    ...existing,
    term,
    category,
    pronunciation: (updates.pronunciation || "").trim() || null,
    shortDefinition: (updates.shortDefinition || "").trim() || null,
    extendedDefinition: (updates.extendedDefinition || "").trim() || null,
    relatedTerms: splitRelatedTerms(updates.relatedTerms),
    example: (updates.example || "").trim() || null,
    image: updates.image || existing.image || null,
  };

  await promisifyRequest(getStore(db, "readwrite").put(record));
  return record;
}

/** Delete a visitor-authored term. Refuses to delete official terms. */
export async function deleteCustomTerm(id) {
  const db = await openDatabase();
  const existing = await promisifyRequest(getStore(db, "readonly").get(id));
  if (!existing) return;
  if (existing.source !== "custom") throw new Error("Official terms cannot be deleted.");
  await promisifyRequest(getStore(db, "readwrite").delete(id));
}

/** Flip a term's favorite flag (works for both official and custom terms). */
export async function toggleFavorite(id) {
  const db = await openDatabase();
  const existing = await promisifyRequest(getStore(db, "readonly").get(id));
  if (!existing) throw new Error("Term not found.");
  const record = { ...existing, favorite: !existing.favorite };
  await promisifyRequest(getStore(db, "readwrite").put(record));
  return record.favorite;
}

/** All visitor-authored terms, for the "Backup my terms" export. */
export async function exportCustomTerms() {
  const all = await getAllTerms();
  return all.filter((t) => t.source === "custom");
}

/**
 * Import terms from a previously exported backup file. Each record is
 * re-validated and re-keyed as a fresh custom term so imported data can
 * never masquerade as one of the official 100 or collide with an existing id.
 */
export async function importCustomTerms(records) {
  if (!Array.isArray(records)) throw new Error("Backup file is not a valid terms export.");

  const db = await openDatabase();
  let imported = 0;
  let skipped = 0;

  const tx = db.transaction(STORE_TERMS, "readwrite");
  const store = tx.objectStore(STORE_TERMS);

  for (const raw of records) {
    const term = (raw && raw.term) || "";
    const category = (raw && raw.category) || "";
    if (!term.trim() || !category.trim()) {
      skipped++;
      continue;
    }
    const record = {
      id: generateCustomId(term),
      term: term.trim(),
      category: category.trim(),
      pronunciation: raw.pronunciation || null,
      shortDefinition: raw.shortDefinition || null,
      extendedDefinition: raw.extendedDefinition || null,
      relatedTerms: splitRelatedTerms(raw.relatedTerms),
      example: raw.example || null,
      image: raw.image || null,
      antonym: null,
      source: "custom",
      favorite: Boolean(raw.favorite),
      createdAt: Date.now(),
    };
    store.put(record);
    imported++;
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  return { imported, skipped };
}
