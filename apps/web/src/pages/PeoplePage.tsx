import { useEffect, useState } from "react";
import type { Person } from "@familypassportmap/shared";
import { createPerson, deletePerson, listPeople, updatePerson, uploadPersonPhoto } from "../api/people";
import { getAllVisits, type PersonVisits } from "../api/visits";
import { PersonAvatar } from "../components/PersonAvatar";
import { StateCounter } from "../components/StateCounter";

const DEFAULT_COLOR = "#3366cc";

/**
 * The People page: add, edit, and delete family members, each shown with their avatar,
 * name, and visited-state count.
 */
export function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [visits, setVisits] = useState<PersonVisits[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [newColorTouched, setNewColorTouched] = useState(false);
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  /** Reloads the people list and their visit counts from the server. */
  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [loadedPeople, loadedVisits] = await Promise.all([listPeople(), getAllVisits()]);
      setPeople(loadedPeople);
      setVisits(loadedVisits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load people");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Looks up how many states a person has visited.
   * @param personId - the person's id.
   * @returns the number of states on record for them, or 0 if they have none.
   */
  function stateCountFor(personId: string): number {
    return visits.find((v) => v.personId === personId)?.stateCodes.length ?? 0;
  }

  /**
   * Validates the "Add a person" form before submit.
   * @returns true if the form is valid; otherwise populates `formErrors` and returns false.
   */
  function validateAddForm(): boolean {
    const errors: Record<string, string> = {};
    // Name is required.
    if (!newName.trim()) errors.name = "Name is required.";
    // A color must have been explicitly picked, not just left at the default.
    if (!newColorTouched) errors.color = "Please choose a color.";
    // Photo is optional, but if provided it must fit the size limit.
    if (newPhoto && newPhoto.size > 5 * 1024 * 1024) errors.photo = "Photo must be under 5 MB.";
    // ...and be one of the allowed image types.
    if (newPhoto && !["image/jpeg", "image/png", "image/webp"].includes(newPhoto.type)) {
      errors.photo = "Photo must be JPEG, PNG, or WebP.";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Submits the "Add a person" form: creates the person, then uploads their photo if one
   * was chosen.
   * @param event - the form submit event.
   */
  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!validateAddForm()) return;

    setSubmitting(true);
    setError(null);
    try {
      const person = await createPerson({ name: newName.trim(), colorHex: newColor });
      // Photo upload is a separate request, only made if a photo was actually chosen.
      if (newPhoto) {
        await uploadPersonPhoto(person.id, newPhoto);
      }
      setNewName("");
      setNewColor(DEFAULT_COLOR);
      setNewColorTouched(false);
      setNewPhoto(null);
      setFormErrors({});
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add person");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Switches a person's row into edit mode, seeding the edit form with their current values.
   * @param person - the person to edit.
   */
  function startEdit(person: Person) {
    setEditingId(person.id);
    setEditName(person.name);
    setEditColor(person.colorHex);
  }

  /**
   * Saves an in-progress edit for a person.
   * @param id - the id of the person being edited.
   */
  async function handleSaveEdit(id: string) {
    if (!editName.trim()) {
      setError("Name cannot be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePerson(id, { name: editName.trim(), colorHex: editColor });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update person");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Uploads a replacement photo for a person while editing.
   * @param id - the id of the person whose photo is being replaced.
   * @param file - the newly chosen photo file.
   */
  async function handleEditPhoto(id: string, file: File) {
    setError(null);
    try {
      await uploadPersonPhoto(id, file);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    }
  }

  /**
   * Deletes a person after their inline delete confirmation is accepted.
   * @param id - the id of the person to delete.
   */
  async function handleDelete(id: string) {
    setError(null);
    try {
      await deletePerson(id);
      setDeletingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete person");
    }
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold mb-6">People</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleAdd} className="mb-8 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <h2 className="text-lg font-semibold mb-3">Add a person</h2>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <label className="flex flex-col gap-1 text-sm font-medium flex-1 min-w-0">
            Name
            <input
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setFormErrors((p) => ({ ...p, name: "" })); }}
              className={`px-3 py-2 rounded-md border bg-[var(--color-bg)] text-[var(--color-text)] text-base ${formErrors.name ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"}`}
              placeholder="e.g. Alice"
            />
            {formErrors.name && <span className="text-xs text-[var(--color-danger)]">{formErrors.name}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Color
            <input
              type="color"
              value={newColor}
              onChange={(e) => {
                setNewColor(e.target.value);
                setNewColorTouched(true);
                setFormErrors((p) => ({ ...p, color: "" }));
              }}
              className={`w-10 h-10 rounded cursor-pointer border ${formErrors.color ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"}`}
            />
            {formErrors.color && <span className="text-xs text-[var(--color-danger)]">{formErrors.color}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => { setNewPhoto(e.target.files?.[0] ?? null); setFormErrors((p) => ({ ...p, photo: "" })); }}
              className="text-sm text-[var(--color-text-muted)]"
            />
            {formErrors.photo && <span className="text-xs text-[var(--color-danger)]">{formErrors.photo}</span>}
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white font-medium text-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {submitting ? "Adding…" : "Add person"}
          </button>
        </div>
      </form>

      <h2 className="text-lg font-semibold mb-3">Family</h2>
      {loading ? (
        <p className="text-[var(--color-text-muted)]">Loading…</p>
      ) : people.length === 0 ? (
        <p className="text-[var(--color-text-muted)]">No one added yet. Use the form above to add your first family member.</p>
      ) : (
        <ul className="space-y-2">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]"
            >
              <PersonAvatar person={person} />
              {/* Each row renders one of three mutually exclusive states: editing this
                  person, confirming their deletion, or the normal read-only view. */}
              {editingId === person.id ? (
                <div className="flex flex-col sm:flex-row gap-2 flex-1 min-w-0 items-start sm:items-center">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm flex-1 min-w-0"
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-[var(--color-border)]"
                  />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleEditPhoto(person.id, file);
                    }}
                    className="text-xs text-[var(--color-text-muted)]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(person.id)}
                      disabled={saving}
                      className="px-3 py-1 rounded bg-[var(--color-primary)] text-white text-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 rounded border border-[var(--color-border)] text-sm hover:bg-[var(--color-bg-card)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : deletingId === person.id ? (
                <div className="flex flex-col sm:flex-row gap-2 flex-1 min-w-0 items-start sm:items-center">
                  <span className="text-sm">Delete <strong>{person.name}</strong>? Their visited-state history will also be removed.</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(person.id)}
                      className="px-3 py-1 rounded bg-[var(--color-danger)] text-white text-sm hover:bg-[var(--color-danger-hover)] transition-colors"
                    >
                      Confirm delete
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1 rounded border border-[var(--color-border)] text-sm hover:bg-[var(--color-bg-card)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="font-medium flex-1 min-w-0 truncate flex items-center gap-2">
                    {person.name}
                    <StateCounter count={stateCountFor(person.id)} />
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(person)}
                      className="px-3 py-1 rounded border border-[var(--color-border)] text-sm hover:bg-[var(--color-bg-card)] transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingId(person.id)}
                      className="px-3 py-1 rounded border border-[var(--color-danger)] text-[var(--color-danger)] text-sm hover:bg-[var(--color-danger)] hover:text-white transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
