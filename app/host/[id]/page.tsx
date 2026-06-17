import { getGame } from "@/lib/server/store";
import { HostClient } from "./HostClient";
import { QuizHostClient } from "./QuizHostClient";

export default async function HostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (game?.game_type === "quiz") return <QuizHostClient gameId={id} />;
  return <HostClient gameId={id} />;
}
