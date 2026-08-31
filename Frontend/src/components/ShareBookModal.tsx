import { type FormEvent, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, Trash2, Crown } from "lucide-react";

import { avatarColor, initials } from "@/components/PresenceAvatars";
import {
  addCollaborator,
  getCollaborators,
  removeCollaborator,
  updateCollaboratorRole,
  type ApiBook,
  type ApiCollaborator,
  type BookAccessRole,
  type CollaboratorRole,
} from "@/lib/api";

interface ShareBookModalProps {
  book: ApiBook;
  currentUserId: string;
  onClose: () => void;
  /** Called after the current user removes themself from the book. */
  onLeave?: () => void;
}

const roleLabels: Record<CollaboratorRole, string> = {
  EDITOR: "Can edit",
  VIEWER: "Can view",
};

const ShareBookModal = ({ book, currentUserId, onClose, onLeave }: ShareBookModalProps) => {
  const [accessRole, setAccessRole] = useState<BookAccessRole>(book.accessRole);
  const [owner, setOwner] = useState(book.owner);
  const [collaborators, setCollaborators] = useState<ApiCollaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("EDITOR");
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOwner = accessRole === "OWNER";

  useEffect(() => {
    let active = true;

    getCollaborators(book.id)
      .then((result) => {
        if (!active) {
          return;
        }

        setAccessRole(result.accessRole);
        setOwner(result.owner);
        setCollaborators(result.collaborators);
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load collaborators");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [book.id]);

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const added = await addCollaborator(book.id, trimmed, role);
      setCollaborators((prev) => {
        const without = prev.filter((entry) => entry.userId !== added.userId);
        return [...without, added];
      });
      setEmail("");
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Failed to add collaborator");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeRole = async (userId: string, nextRole: CollaboratorRole) => {
    setBusyUserId(userId);
    setError(null);

    try {
      const updated = await updateCollaboratorRole(book.id, userId, nextRole);
      setCollaborators((prev) => prev.map((entry) => (entry.userId === userId ? updated : entry)));
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "Failed to update role");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRemove = async (userId: string) => {
    setBusyUserId(userId);
    setError(null);

    try {
      await removeCollaborator(book.id, userId);
      setCollaborators((prev) => prev.filter((entry) => entry.userId !== userId));

      if (userId === currentUserId) {
        onLeave?.();
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove collaborator");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative bg-card rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-lg font-bold text-foreground">Share “{book.title}”</h2>
              <p className="text-sm text-muted-foreground">
                {isOwner
                  ? "Invite people by the email they signed up with."
                  : "People who can work on this book."}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {isOwner ? (
              <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="collaborator@example.com"
                  required
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as CollaboratorRole)}
                  className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground"
                >
                  <option value="EDITOR">{roleLabels.EDITOR}</option>
                  <option value="VIEWER">{roleLabels.VIEWER}</option>
                </select>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:scale-[1.02] btn-press disabled:opacity-60"
                >
                  <UserPlus className="w-4 h-4" /> {submitting ? "Adding..." : "Invite"}
                </button>
              </form>
            ) : null}

            <div className="space-y-1">
              <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl">
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white ${avatarColor(owner.id)}`}
                >
                  {initials(owner.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {owner.name}
                    {owner.id === currentUserId ? " (you)" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{owner.email}</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Crown className="w-3.5 h-3.5" /> Owner
                </span>
              </div>

              {loading ? <p className="px-2 text-sm text-muted-foreground">Loading collaborators...</p> : null}

              {!loading && collaborators.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  {isOwner ? "Nobody else has access yet." : "No other collaborators."}
                </p>
              ) : null}

              {collaborators.map((entry) => {
                const isSelf = entry.userId === currentUserId;
                const busy = busyUserId === entry.userId;

                return (
                  <div key={entry.userId} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/60">
                    <span
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white ${avatarColor(entry.userId)}`}
                    >
                      {initials(entry.name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {entry.name}
                        {isSelf ? " (you)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{entry.email}</p>
                    </div>
                    {isOwner ? (
                      <select
                        value={entry.role}
                        disabled={busy}
                        onChange={(event) => void handleChangeRole(entry.userId, event.target.value as CollaboratorRole)}
                        className="px-2 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground disabled:opacity-60"
                      >
                        <option value="EDITOR">{roleLabels.EDITOR}</option>
                        <option value="VIEWER">{roleLabels.VIEWER}</option>
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground">{roleLabels[entry.role]}</span>
                    )}
                    {isOwner || isSelf ? (
                      <button
                        onClick={() => void handleRemove(entry.userId)}
                        disabled={busy}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-60"
                        title={isSelf ? "Leave this book" : "Remove access"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ShareBookModal;
