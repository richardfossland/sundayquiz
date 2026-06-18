import { fail, ok } from "@/lib/server/http";
import { requireHostUser, hostAuthFail } from "@/lib/server/auth-host";
import { deleteOwnedGame, getGameOwner } from "@/lib/server/host-games";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/games/[id] — a signed-in Sunday host deletes one of THEIR games.
//   401 → not signed in (no Sunday session)
//   403 → signed in but not the owner (or not a host email)
//   404 → game doesn't exist
//   200 → deleted (children cascade via FK)
//
// This is the ONLY game mutation behind Sunday Account auth. Code-based host
// actions (start/end/kick) are unchanged and still gated by host_code.
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;

  let userId: string;
  try {
    const user = await requireHostUser();
    userId = user.id;
  } catch (err) {
    const res = hostAuthFail(err);
    if (res) return res;
    console.error("[games:delete:auth]", err);
    return fail(500, "delete_failed");
  }

  try {
    const owner = await getGameOwner(id);
    if (owner === undefined) return fail(404, "not_found");
    const deleted = await deleteOwnedGame(id, userId);
    if (!deleted) return fail(403, "not_owner");
    return ok({ ok: true });
  } catch (err) {
    console.error("[games:delete]", err);
    return fail(500, "delete_failed");
  }
}
