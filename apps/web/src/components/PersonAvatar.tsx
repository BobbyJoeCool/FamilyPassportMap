import type { Person } from "@familypassportmap/shared";

// Reused anywhere a person's icon appears (People page now; Map/Compare/List in later phases).
export function PersonAvatar({ person, size = 40 }: { person: Person; size?: number }) {
  const style = { width: size, height: size, borderRadius: "50%" };

  if (person.profilePicturePath) {
    return (
      <img
        src={`/${person.profilePicturePath}`}
        alt={person.name}
        style={{ ...style, objectFit: "cover" }}
      />
    );
  }

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
