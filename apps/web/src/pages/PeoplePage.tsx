import { useEffect, useState } from "react";
import type { Person } from "@familypassportmap/shared";
import { createPerson, deletePerson, listPeople, updatePerson, uploadPersonPhoto } from "../api/people";
import { PersonAvatar } from "../components/PersonAvatar";

const DEFAULT_COLOR = "#3366cc";

export function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [newColorTouched, setNewColorTouched] = useState(false);
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setPeople(await listPeople());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load people");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!newColorTouched) {
      setError("Please choose a color before adding a person.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const person = await createPerson({ name: newName, colorHex: newColor });
      if (newPhoto) {
        await uploadPersonPhoto(person.id, newPhoto);
      }
      setNewName("");
      setNewColor(DEFAULT_COLOR);
      setNewColorTouched(false);
      setNewPhoto(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add person");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(person: Person) {
    setEditingId(person.id);
    setEditName(person.name);
    setEditColor(person.colorHex);
  }

  async function handleSaveEdit(id: string) {
    setError(null);
    try {
      await updatePerson(id, { name: editName, colorHex: editColor });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update person");
    }
  }

  async function handleEditPhoto(id: string, file: File) {
    setError(null);
    try {
      await uploadPersonPhoto(id, file);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deletePerson(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete person");
    }
  }

  return (
    <div>
      <h1>People</h1>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <form onSubmit={handleAdd}>
        <h2>Add a person</h2>
        <label>
          Name
          <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
        </label>
        <label>
          Color
          <input
            type="color"
            value={newColor}
            onChange={(e) => {
              setNewColor(e.target.value);
              setNewColorTouched(true);
            }}
          />
        </label>
        <label>
          Photo (optional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" disabled={submitting}>
          Add person
        </button>
      </form>

      <h2>Family</h2>
      {loading ? (
        <p>Loading…</p>
      ) : people.length === 0 ? (
        <p>No one added yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {people.map((person) => (
            <li key={person.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <PersonAvatar person={person} />
              {editingId === person.id ? (
                <>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleEditPhoto(person.id, file);
                    }}
                  />
                  <button onClick={() => handleSaveEdit(person.id)}>Save</button>
                  <button onClick={() => setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span>{person.name}</span>
                  <button onClick={() => startEdit(person)}>Edit</button>
                  <button onClick={() => handleDelete(person.id)}>Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
