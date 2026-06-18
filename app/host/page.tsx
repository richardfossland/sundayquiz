import { redirect } from "next/navigation";

import { getHostUser } from "@/lib/server/auth-host";
import { listGamesByOwner } from "@/lib/server/host-games";
import { HostDashboard } from "./HostDashboard";

// Signed-in host dashboard. Middleware already redirects logged-OUT users to
// /host/login; this re-checks server-side (defense in depth) and loads the
// host's own games. Anonymous hosting is unaffected — this surface is purely
// additive (the per-game console at /host/<id> stays code-based).
export const dynamic = "force-dynamic";

export default async function HostDashboardPage() {
  const user = await getHostUser();
  if (!user) redirect("/host/login");

  const games = await listGamesByOwner(user.id);
  return <HostDashboard email={user.email ?? ""} games={games} />;
}
