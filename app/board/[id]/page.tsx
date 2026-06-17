import { getGame } from "@/lib/server/store";
import { BoardClient } from "./BoardClient";
import { QuizBoardClient } from "./QuizBoardClient";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (game?.game_type === "quiz") return <QuizBoardClient gameId={id} />;
  return <BoardClient gameId={id} />;
}
