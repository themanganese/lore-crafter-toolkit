import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — CreatorForge" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="px-8 py-12 max-w-3xl mx-auto">
      <header className="mb-8">
        <SettingsIcon className="h-8 w-8 text-gold mb-3" />
        <h1 className="font-display text-3xl text-gradient-gold">Settings</h1>
      </header>

      <section className="panel-grim p-6 mb-6">
        <h2 className="font-display text-2xl uppercase tracking-[0.3em] text-gold-dim mb-4">
          API Keys
        </h2>
        <p className="text-base text-muted-foreground leading-relaxed mb-3">
          API keys for SensorTower (ad intelligence) and Scenario (creative
          generation) are stored as server secrets and never exposed to the
          browser. To rotate them, use the Lovable secrets panel.
        </p>
        <ul className="text-base space-y-1.5">
          <li className="flex justify-between">
            <span className="text-muted-foreground">SENSORTOWER_API_KEY</span>
            <span className="text-gold">configured · server-only</span>
          </li>
          <li className="flex justify-between">
            <span className="text-muted-foreground">SCENARIO_API_KEY</span>
            <span className="text-gold">configured · server-only</span>
          </li>
          <li className="flex justify-between">
            <span className="text-muted-foreground">LOVABLE_API_KEY (AI)</span>
            <span className="text-gold">managed · server-only</span>
          </li>
        </ul>
      </section>

      <section className="panel-grim p-6 mb-6">
        <h2 className="font-display text-2xl uppercase tracking-[0.3em] text-gold-dim mb-4">
          Storage
        </h2>
        <p className="text-base text-muted-foreground leading-relaxed">
          All characters, briefs, and generated creatives are stored locally in
          your browser (IndexedDB). Use the <em>Share</em> action on any
          character to export a portable snapshot URL.
        </p>
      </section>

      <Link to="/" className="gold-frame inline-block px-4 py-2 font-display text-gold-bright">
        Back to Forge
      </Link>
    </div>
  );
}
