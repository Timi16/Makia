import type { PresenceUser } from "@/lib/realtime";

const avatarPalette = [
  "bg-cyan-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-orange-500",
];

export function avatarColor(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return avatarPalette[hash % avatarPalette.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface PresenceAvatarsProps {
  chapterLabels: Record<string, string>;
  currentConnectionId: string | null;
  max?: number;
  users: PresenceUser[];
}

/** Renders one avatar per other person currently in the book's realtime room. */
const PresenceAvatars = ({ chapterLabels, currentConnectionId, max = 5, users }: PresenceAvatarsProps) => {
  const others = new Map<string, PresenceUser>();

  users.forEach((user) => {
    if (user.connectionId === currentConnectionId) {
      return;
    }

    // One avatar per person, even if they have several tabs open.
    if (!others.has(user.userId)) {
      others.set(user.userId, user);
    }
  });

  const visible = Array.from(others.values());

  if (visible.length === 0) {
    return (
      <span className="hidden lg:inline text-xs text-muted-foreground" title="No one else is here right now">
        Only you
      </span>
    );
  }

  const shown = visible.slice(0, max);
  const overflow = visible.length - shown.length;

  return (
    <div className="flex -space-x-2">
      {shown.map((user) => {
        const where = user.chapterId && chapterLabels[user.chapterId] ? ` · ${chapterLabels[user.chapterId]}` : "";

        return (
          <div key={user.userId} className="relative" title={`${user.name}${where}`}>
            <span
              className={`w-8 h-8 rounded-full border-2 border-card flex items-center justify-center text-[11px] font-semibold text-white ${avatarColor(user.userId)}`}
            >
              {initials(user.name)}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-card" />
          </div>
        );
      })}
      {overflow > 0 ? (
        <span className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
};

export default PresenceAvatars;
