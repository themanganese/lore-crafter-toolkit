import { useState, useRef, useEffect } from "react";
import { useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { askAI } from "@/lib/server.functions";
import { useCharacter } from "@/hooks/use-characters";
import { saveCharacter } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const QUICK_PROMPTS = [
  "Why is my visual novelty low?",
  "Suggest 3 hooks I should test",
  "What should I do next?",
];

export function AskAIFloating() {
  const [open, setOpen] = useState(false);
  const params = useParams({ strict: false }) as { gameId?: string };
  const { character, refresh } = useCharacter(params.gameId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const ask = useServerFn(askAI);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages: ChatMessage[] = character?.chatMessages ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    let history: ChatMessage[] = [...messages, userMsg];
    if (character) {
      await saveCharacter({ ...character, chatMessages: history });
      refresh();
    }

    try {
      const ctx = character?.scoreBreakdown
        ? {
            name: character.name,
            vertical: character.vertical,
            winProbability: character.scoreBreakdown.winProbability,
            topHooks: character.topHooks.map((h) => h.label),
            stats: character.scoreBreakdown.dimensions.map((d) => ({ label: d.label, value: d.value })),
            codex: character.codex,
            differentiationAngle: character.trendAnalysis?.differentiationAngle,
          }
        : character
        ? { name: character.name, vertical: character.vertical }
        : undefined;

      const r = await ask({
        data: {
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          gameContext: ctx,
        },
      });

      if (!r.ok) {
        toast.error(r.error ?? "AI failed");
        return;
      }
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: r.content,
        createdAt: new Date().toISOString(),
      };
      history = [...history, aiMsg];
      if (character) {
        await saveCharacter({ ...character, chatMessages: history });
        refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Ask Silki AI"
        className={cn(
          "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full btn-copper fab-glow flex items-center justify-center transition-transform hover:scale-105",
          open && "scale-90"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <aside className="fixed bottom-24 right-6 z-40 w-[min(420px,calc(100vw-3rem))] h-[min(620px,calc(100vh-8rem))] panel-grim flex flex-col overflow-hidden shadow-2xl">
          <header className="px-4 py-3 border-b border-border bg-parchment flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-bright" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-2xl text-foreground">Ask Silki</div>
              <div className="text-base uppercase tracking-widest text-muted-foreground truncate">
                {character ? `Context: ${character.name}` : "General creative-strategy"}
              </div>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <p className="text-base text-muted-foreground mb-3">
                  Ask anything about creative strategy.
                </p>
                <div className="space-y-1.5">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="block w-full text-left px-3 py-2 rounded-sm border border-border hover:border-gold/50 hover:bg-gold/5 text-base text-foreground/85 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-sm p-3 max-w-[92%] text-base",
                  m.role === "user"
                    ? "ml-auto bg-gold/15 border border-gold/30 text-foreground"
                    : "bg-muted/40 border border-border text-foreground/90"
                )}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-base max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-li:text-foreground/85 prose-code:text-gold prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-muted-foreground text-base">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border p-2 flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={character ? `Ask about ${character.name}…` : "Ask Silki…"}
              className="flex-1 resize-none bg-input border border-border rounded-sm px-3 py-2 text-base focus:outline-none focus:border-gold/60 max-h-32"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="btn-copper h-9 w-9 rounded-sm flex items-center justify-center disabled:opacity-50 shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
