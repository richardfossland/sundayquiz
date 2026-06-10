import { HostClient } from "./HostClient";

export default async function HostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HostClient gameId={id} />;
}
