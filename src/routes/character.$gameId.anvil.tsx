import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/character/$gameId/anvil")({
  component: AnvilRedirect,
});

function AnvilRedirect() {
  const { gameId } = Route.useParams();
  return <Navigate to="/character/$gameId" params={{ gameId }} replace />;
}
