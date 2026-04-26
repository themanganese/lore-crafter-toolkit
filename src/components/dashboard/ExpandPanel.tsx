import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandPanelProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  emphasis?: boolean;
  children: ReactNode;
}

export function ExpandPanel({
  title,
  subtitle,
  icon,
  defaultOpen = true,
  badge,
  emphasis,
  children,
}: ExpandPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={cn(
        "panel-grim overflow-hidden",
        emphasis && "ring-1 ring-gold/30"
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gold/5 transition-colors text-left"
      >
        {icon && <div className="text-gold">{icon}</div>}
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-sm text-foreground tracking-wide">{title}</h3>
          {subtitle && (
            <p className="text-sm uppercase tracking-widest text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {badge}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gold-dim transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <>
          <div className="ornate-rule" />
          <div className="px-5 py-5">{children}</div>
        </>
      )}
    </section>
  );
}
