import type { DemoSeed } from "./seed";

// The guest demo's in-memory data: what the real server keeps in SQLite and the uploads folder.
// Held only in this object. Nothing goes to localStorage, sessionStorage or IndexedDB, so a
// reload (which builds a new store from the seed) always starts over.

/** A Person as the demo stores it (the API adds `isPrimary` when it answers). */
export interface DemoPerson {
  id: string;
  name: string;
  colorHex: string;
  /** "uploads/<file>", the same form the server stores, or null for no photo. */
  profilePicturePath: string | null;
  createdAt: string;
}

/** Everything the demo's fake API reads and writes. */
export interface DemoStore {
  /** Oldest first, the order the server lists People in. */
  people: DemoPerson[];
  primaryPersonId: string;
  /** Person id → visited state codes. */
  states: Map<string, Set<string>>;
  /** Person id → visited country codes. */
  countries: Map<string, Set<string>>;
  /** Photo file name (the part after "uploads/") → the photo's bytes. */
  photos: Map<string, Blob>;
  /** Counter for new ids and photo file names, so every one is unique within the store. */
  nextId: number;
}

/** When the seed's People were "added": fixed, so every demo starts identical. */
const SEED_START = Date.UTC(2026, 0, 1);

/**
 * Builds a fresh store from a seed. Each call returns a brand-new, independent store.
 * @param seed - the People (and their visits and photos) to start with.
 * @returns the new store.
 * @throws if the seed doesn't have exactly one Primary Person.
 */
export function createStore(seed: DemoSeed): DemoStore {
  const primaries = seed.people.filter((person) => person.isPrimary);
  // Every User has exactly one Primary Person; a seed without one would show the welcome step.
  if (primaries.length !== 1) {
    throw new Error(`A demo seed needs exactly one Primary Person, found ${primaries.length}`);
  }

  const store: DemoStore = {
    people: [],
    primaryPersonId: "",
    states: new Map(),
    countries: new Map(),
    photos: new Map(),
    nextId: 1,
  };

  // Turn each seed Person into a stored Person, a minute apart so "oldest first" is stable.
  seed.people.forEach((seedPerson, index) => {
    const id = newId(store, "person");
    let profilePicturePath: string | null = null;
    // A seed photo goes in the photo store under its own file name, like an upload would.
    if (seedPerson.photo) {
      store.photos.set(seedPerson.photo.fileName, new Blob([seedPerson.photo.contents], { type: seedPerson.photo.type }));
      profilePicturePath = `uploads/${seedPerson.photo.fileName}`;
    }
    store.people.push({
      id,
      name: seedPerson.name,
      colorHex: seedPerson.colorHex,
      profilePicturePath,
      createdAt: new Date(SEED_START + index * 60_000).toISOString(),
    });
    store.states.set(id, new Set(seedPerson.states));
    store.countries.set(id, new Set(seedPerson.countries));
    // The seed's one Primary Person becomes the visitor's "You".
    if (seedPerson.isPrimary) store.primaryPersonId = id;
  });

  return store;
}

/**
 * A new id, unique within the store.
 * @param store - the store whose counter to advance.
 * @param kind - a readable prefix ("person", "photo").
 * @returns e.g. "demo-person-5".
 */
export function newId(store: DemoStore, kind: string): string {
  // Post-increment: this id takes the current number, and the next call gets the one after.
  return `demo-${kind}-${store.nextId++}`;
}
