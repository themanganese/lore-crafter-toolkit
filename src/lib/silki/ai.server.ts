// Shared AI helper — server only. Routes ALL AI through Anthropic Claude.
// Exposes the same callAITool / callAIChat surface as before so every
// existing agent (score, trend, revenue, curation, insights, askAI,
// inspired briefs, etc.) keeps working unchanged.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-5";

function key() {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) throw new Error("ANTHROPIC_API_KEY is not configured");
  return k;
}

function mapClaudeError(status: number, body: string): Error {
  if (status === 429) return new Error("Claude rate limit exceeded — try again in a moment.");
  if (status === 401) return new Error("Claude API key invalid — check ANTHROPIC_API_KEY.");
  if (status === 402 || status === 403)
    return new Error("Claude billing/permission error — check your Anthropic plan.");
  return new Error(`Claude error ${status}: ${body.slice(0, 240)}`);
}

/**
 * Structured output via Claude tool-use. The model is forced to call `toolName`
 * with arguments matching `parameters` (JSON schema). We return the parsed args.
 */
export async function callAITool<T>(args: {
  system: string;
  user: string;
  toolName: string;
  parameters: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key(),
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model ?? DEFAULT_MODEL,
      max_tokens: args.maxTokens ?? 4096,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
      tools: [
        {
          name: args.toolName,
          description: `Submit the structured ${args.toolName} payload.`,
          input_schema: args.parameters,
        },
      ],
      tool_choice: { type: "tool", name: args.toolName },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw mapClaudeError(res.status, t);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };
  const block = data.content?.find((c) => c.type === "tool_use" && c.name === args.toolName);
  if (!block?.input) throw new Error(`Claude did not return tool_use for ${args.toolName}`);
  return block.input as T;
}

/**
 * Plain chat completion. Returns assistant text. Used by Ask AI assistant.
 */
export async function callAIChat(args: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key(),
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model ?? DEFAULT_MODEL,
      max_tokens: args.maxTokens ?? 2048,
      system: args.system,
      messages: args.messages,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw mapClaudeError(res.status, t);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return (
    data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}
