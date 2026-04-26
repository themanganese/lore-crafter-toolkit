import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Loader2, Pencil, Skull } from "lucide-react";
import { useCharacter } from "@/hooks/use-characters";

export const Route = createFileRoute("/character/$gameId/variant/$variantId")({
  head: () => ({ meta: [{ title: "Variant — Forge by Silki" }] }),
  component: VariantPage,
});

function VariantPage() {
  const { gameId, variantId } = Route.useParams();
  const { character, loading } = useCharacter(gameId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <Loader2 className="h-6 w-6 text-gold-dim animate-spin mb-3" />
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Retrieving variant from the codex…
        </p>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <Skull className="h-12 w-12 text-muted-foreground mb-4" />
        <Link to="/" className="gold-frame px-4 py-2 font-display text-gold-bright">
          Return to Forge
        </Link>
      </div>
    );
  }

  const gen = character.generations.find((g) => g.id === variantId);
  // Allow gallery-item ids too, for legacy/uploaded entries.
  const galleryItem = !gen ? character.gallery.find((g) => g.id === variantId) : null;

  if (!gen && !galleryItem) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <p className="font-mono text-sm text-muted-foreground mb-4">
          Variant not found in this character's gallery.
        </p>
        <Link
          to="/character/$gameId"
          params={{ gameId }}
          className="gold-frame px-4 py-2 font-display text-gold-bright"
        >
          Back to dossier
        </Link>
      </div>
    );
  }

  const imageUrl = gen?.imageUrl ?? galleryItem?.imageUrl ?? "";
  const prompt = gen?.prompt ?? "(no prompt — uploaded reference)";
  const model = gen?.model ?? "—";
  const createdAt = gen?.createdAt ?? galleryItem?.createdAt ?? "";
  const versionIndex = gen ? character.generations.findIndex((g) => g.id === gen.id) : -1;
  const version =
    versionIndex >= 0
      ? `V${(character.generations.length - versionIndex).toString().padStart(2, "0")}`
      : "REF";

  const brief = gen ? character.briefs.find((b) => b.id === gen.briefId) : null;

  return (
    <div className="px-8 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/character/$gameId"
          params={{ gameId }}
          className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-gold-bright flex items-center gap-1.5"
        >
          <ArrowLeft className="h-3 w-3" /> Back to {character.name}
        </Link>
        <div className="font-display text-xs uppercase tracking-[0.4em] text-gold-dim">
          Variant · {version}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="gold-frame p-3 bg-card">
          <img
            src={imageUrl}
            alt={brief?.title ?? "variant"}
            className="w-full h-auto rounded-sm"
          />
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="font-mono text-[10px] text-muted-foreground">
              {createdAt && new Date(createdAt).toLocaleString()} · {model}
            </span>
            <div className="flex items-center gap-3">
              {gen && (
                <Link
                  to="/character/$gameId/edit/$generationId"
                  params={{ gameId, generationId: gen.id }}
                  className="font-mono text-[10px] uppercase tracking-widest text-gold-bright hover:underline flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" /> Edit in Anvil
                </Link>
              )}
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="font-mono text-[10px] uppercase tracking-widest text-gold-bright hover:underline flex items-center gap-1"
              >
                <Download className="h-3 w-3" /> Download
              </a>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel-grim p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim mb-1.5">
              Brief
            </div>
            {brief ? (
              <>
                <div className="font-display text-base text-foreground">{brief.title}</div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  For {brief.targetGameName}
                </div>
                {brief.targetHook && (
                  <p className="font-body text-xs text-foreground/80 mt-2 leading-relaxed">
                    {brief.targetHook}
                  </p>
                )}
              </>
            ) : (
              <p className="font-body text-xs text-muted-foreground italic">
                Untethered variant — no brief associated.
              </p>
            )}
          </div>

          <div className="panel-grim p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim mb-1.5">
              Scenario prompt
            </div>
            <p className="font-mono text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {prompt}
            </p>
          </div>

          <div className="panel-grim p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-gold-dim mb-1.5">
              Metadata
            </div>
            <dl className="grid grid-cols-[80px_1fr] gap-y-1 text-xs font-mono">
              <dt className="text-muted-foreground">ID</dt>
              <dd className="text-foreground/85 truncate">{variantId}</dd>
              <dt className="text-muted-foreground">Model</dt>
              <dd className="text-foreground/85">{model}</dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="text-foreground/85">
                {createdAt && new Date(createdAt).toLocaleString()}
              </dd>
              {gen?.parentId && (
                <>
                  <dt className="text-muted-foreground">Parent</dt>
                  <dd className="text-foreground/85 truncate">{gen.parentId}</dd>
                </>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
