import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Roster } from "@/components/Roster";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-gradient-gold">404</h1>
        <h2 className="mt-4 font-display text-xl text-foreground">Path leads nowhere</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you seek does not exist in this realm.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center gold-frame px-5 py-2 text-sm font-display tracking-wider text-gold-bright hover:bg-gold/10 transition-colors"
          >
            Return to Forge
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CreatorForge — Ad Intelligence × Creative Anvil" },
      {
        name: "description",
        content:
          "Analyze top-performing game ads, forge a soulslike character sheet of winning patterns, and generate tailored creatives in one pipeline.",
      },
      { name: "author", content: "CreatorForge" },
      { property: "og:title", content: "CreatorForge — Ad Intelligence × Creative Anvil" },
      {
        property: "og:description",
        content: "Ad intelligence and creative generation in one grim pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "CreatorForge — Ad Intelligence × Creative Anvil" },
      { name: "description", content: "Forge by Silki is a game development tool for creating character sheets and analyzing game data." },
      { property: "og:description", content: "Forge by Silki is a game development tool for creating character sheets and analyzing game data." },
      { name: "twitter:description", content: "Forge by Silki is a game development tool for creating character sheets and analyzing game data." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aeddca08-e984-498b-8914-527fec265f33/id-preview-9cf3a119--0993e6e9-e2ac-4493-98e4-db1c6c53965f.lovable.app-1777130499289.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aeddca08-e984-498b-8914-527fec265f33/id-preview-9cf3a119--0993e6e9-e2ac-4493-98e4-db1c6c53965f.lovable.app-1777130499289.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.cdnfonts.com/css/alte-haas-grotesk",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <div className="flex min-h-screen w-full">
      <Roster />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
