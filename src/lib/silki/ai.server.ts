// Shared Lovable AI gateway helper — server only.
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export async function callAITool<T>(args: {
  system: string;
  user: string;
  toolName: string;
  parameters: Record<string, unknown>;
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: args.toolName,
            parameters: args.parameters,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: args.toolName } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Lovable AI rate limit exceeded — try again in a moment.");
    if (res.status === 402) throw new Error("Lovable AI credits exhausted — top up in Settings → Workspace → Usage.");
    throw new Error(`Lovable AI error ${res.status}: ${t.slice(0, 240)}`);
  }

  const data = await res.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("AI did not return a structured response");
  }
  return JSON.parse(toolCall.function.arguments) as T;
}

export async function callAIChat(args: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  model?: string;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model ?? DEFAULT_MODEL,
      messages: [
        { role: "system", content: args.system },
        ...args.messages,
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Lovable AI rate limit exceeded — try again in a moment.");
    if (res.status === 402) throw new Error("Lovable AI credits exhausted.");
    throw new Error(`Lovable AI error ${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
