import type { Person } from "@familypassportmap/shared";

/**
 * Renders a person's avatar: their uploaded profile picture if they have one, otherwise
 * a colored circle with their initials. Reused anywhere a person's icon appears (People,
 * Map, Compare, List).
 * @param person - the person to render.
 * @param size - the avatar's diameter in pixels (defaults to 40).
 */
export function PersonAvatar({ person, size = 40 }: { person: Person; size?: number }) {
  const style = { width: size, height: size, borderRadius: "50%" };

  // Prefer the uploaded photo when one exists.
  if (person.profilePicturePath) {
    return (
      <img
        src={`/${person.profilePicturePath}`}
        alt={person.name}
        style={{ ...style, objectFit: "cover" }}
      />
    );
  }

  // No photo — fall back to up to two initials derived from the person's name.
  const initials = person.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      style={{
        ...style,
        backgroundColor: person.colorHex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: size * 0.4,
        fontWeight: 600,
      }}
      aria-label={person.name}
    >
      {initials}
    </div>
  );
}
