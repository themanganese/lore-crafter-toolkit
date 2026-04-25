import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Roster } from "@/components/Roster";
import { AskAIFloating } from "@/components/AskAIFloating";
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
      { title: "Forge by Silki — Ad Intelligence × Creative Anvil" },
      {
        name: "description",
        content:
          "Analyze top-performing game ads, build a character sheet of winning patterns, and generate tailored creatives — all in one dashboard.",
      },
      { name: "author", content: "Silki" },
      { property: "og:title", content: "Forge by Silki" },
      {
        property: "og:description",
        content: "Ad intelligence and creative generation in one game-sheet dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
      <AskAIFloating />
      <Toaster />
    </div>
  );
}
