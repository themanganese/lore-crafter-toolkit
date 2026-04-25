import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/character/$gameId/brief")({
  component: BriefRedirect,
});

function BriefRedirect() {
  const { gameId } = Route.useParams();
  return <Navigate to="/character/$gameId" params={{ gameId }} replace />;
}
