// Scenario.gg REST API client — server-only.
// Docs: https://docs.scenario.com/reference/post_v1-generate-txt2img
// Auth: Basic <base64(API_KEY:API_SECRET)> OR Bearer for newer accounts.
// We accept "key:secret" or a single bearer token in SCENARIO_API_KEY.
const BASE = "https://api.cloud.scenario.com/v1";

// Demo mode — when MOCK_SCENARIO=1 in .env.local, skip live API calls
// and return placeholder images. This keeps the demo deterministic
// regardless of Scenario API availability or plan permissions.
const MOCK_SCENARIO = process.env.MOCK_SCENARIO === "1";

const MOCK_IMAGES = [
  "https://picsum.photos/seed/forge1/1024/1024",
  "https://picsum.photos/seed/forge2/1024/1024",
  "https://picsum.photos/seed/forge3/1024/1024",
  "https://picsum.photos/seed/forge4/1024/1024",
];

function pickMockImage(prompt: string): string {
  // Deterministic pick based on prompt — same prompt always returns same image
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) hash = (hash * 31 + prompt.charCodeAt(i)) | 0;
  return MOCK_IMAGES[Math.abs(hash) % MOCK_IMAGES.length];
}

function authHeader() {
  const raw = process.env.SCENARIO_API_KEY;
  if (!raw) throw new Error("SCENARIO_API_KEY is not configured");
  if (raw.includes(":")) {
    // key:secret format → Basic
    const b64 = Buffer.from(raw).toString("base64");
    return `Basic ${b64}`;
  }
  return `Bearer ${raw}`;
}

export interface ScenarioGenResult {
  imageUrl: string;
  jobId: string;
  model: string;
}

export async function generateImage(args: {
  prompt: string;
  modelId?: string;
  width?: number;
  height?: number;
}): Promise<ScenarioGenResult> {
  if (MOCK_SCENARIO) {
    // Simulate API latency so the loading state still feels real in the demo
    await new Promise((r) => setTimeout(r, 1200));
    return {
      imageUrl: pickMockImage(args.prompt),
      jobId: "mock-job",
      model: args.modelId || "mock_model",
    };
  }
  // Public Flux LoRA: "Legendary TCG Characters 2.0" — fits the Forge dossier theme.
  // Override per-call via args.modelId.
  const modelId = args.modelId || "model_1Nhnp4C7eJShiFmSpvopxyUa";

  const submit = await fetch(`${BASE}/generate/txt2img`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prompt: args.prompt,
      modelId,
      width: args.width ?? 1024,
      height: args.height ?? 1024,
      numSamples: 1,
      numInferenceSteps: 30,
      guidance: 7,
    }),
  });

  const submitBody = await submit.text();
  if (!submit.ok) {
    throw new Error(`Scenario submit failed ${submit.status}: ${submitBody.slice(0, 240)}`);
  }
  const submitJson = JSON.parse(submitBody);
  const jobId: string | undefined = submitJson?.job?.jobId ?? submitJson?.jobId ?? submitJson?.id;
  if (!jobId) {
    // Some Scenario plans return immediate image URL
    const direct = submitJson?.images?.[0]?.url || submitJson?.asset?.url;
    if (direct) return { imageUrl: direct, jobId: "immediate", model: modelId };
    throw new Error("Scenario response had no jobId or image URL");
  }

  // Poll job status
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const stat = await fetch(`${BASE}/jobs/${jobId}`, {
      headers: { Authorization: authHeader(), Accept: "application/json" },
    });
    if (!stat.ok) continue;
    const sj = await stat.json();
    const status = sj?.job?.status ?? sj?.status;
    if (status === "success" || status === "completed") {
      const assetId: string | undefined =
        sj?.job?.metadata?.assetIds?.[0] || sj?.assetIds?.[0];
      if (assetId) {
        const asset = await fetch(`${BASE}/assets/${assetId}`, {
          headers: { Authorization: authHeader(), Accept: "application/json" },
        });
        if (asset.ok) {
          const aj = await asset.json();
          const url = aj?.asset?.url || aj?.url;
          if (url) return { imageUrl: url, jobId, model: modelId };
        }
      }
      // Some plans return URLs inline
      const inline =
        sj?.asset?.url || sj?.images?.[0]?.url || sj?.assets?.[0]?.url;
      if (inline && typeof inline === "string" && inline.startsWith("http")) {
        return { imageUrl: inline, jobId, model: modelId };
      }
      throw new Error(`Scenario job completed but no asset URL found: ${JSON.stringify(sj).slice(0, 200)}`);
    }
    if (status === "failure" || status === "failed") {
      throw new Error(`Scenario job failed: ${sj?.job?.statusMessage || sj?.error || "unknown"}`);
    }
  }

  throw new Error("Scenario job timed out after 90s");
}

// Image-to-image (edit) — sends a source image with the new prompt.
export async function editImage(args: {
  prompt: string;
  sourceImageUrl: string;
  modelId?: string;
  strength?: number; // 0..1, how much to deviate
  width?: number;
  height?: number;
}): Promise<ScenarioGenResult> {
  if (MOCK_SCENARIO) {
    await new Promise((r) => setTimeout(r, 1200));
    return {
      imageUrl: pickMockImage(args.prompt),
      jobId: "mock-job",
      model: args.modelId || "mock_model",
    };
  }
  const modelId = args.modelId || "model_1Nhnp4C7eJShiFmSpvopxyUa";

  const submit = await fetch(`${BASE}/generate/img2img`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      prompt: args.prompt,
      modelId,
      image: args.sourceImageUrl,
      strength: args.strength ?? 0.55,
      width: args.width ?? 1024,
      height: args.height ?? 1024,
      numSamples: 1,
      numInferenceSteps: 30,
      guidance: 7,
    }),
  });

  const submitBody = await submit.text();
  if (!submit.ok) {
    throw new Error(`Scenario img2img submit failed ${submit.status}: ${submitBody.slice(0, 240)}`);
  }
  const submitJson = JSON.parse(submitBody);
  const jobId: string | undefined = submitJson?.job?.jobId ?? submitJson?.jobId ?? submitJson?.id;
  if (!jobId) {
    const direct = submitJson?.images?.[0]?.url || submitJson?.asset?.url;
    if (direct) return { imageUrl: direct, jobId: "immediate", model: modelId };
    throw new Error("Scenario img2img response had no jobId or image URL");
  }

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const stat = await fetch(`${BASE}/jobs/${jobId}`, {
      headers: { Authorization: authHeader(), Accept: "application/json" },
    });
    if (!stat.ok) continue;
    const sj = await stat.json();
    const status = sj?.job?.status ?? sj?.status;
    if (status === "success" || status === "completed") {
      const assetId: string | undefined =
        sj?.job?.metadata?.assetIds?.[0] || sj?.assetIds?.[0];
      if (assetId) {
        const asset = await fetch(`${BASE}/assets/${assetId}`, {
          headers: { Authorization: authHeader(), Accept: "application/json" },
        });
        if (asset.ok) {
          const aj = await asset.json();
          const url = aj?.asset?.url || aj?.url;
          if (url) return { imageUrl: url, jobId, model: modelId };
        }
      }
      const inline =
        sj?.asset?.url || sj?.images?.[0]?.url || sj?.assets?.[0]?.url;
      if (inline && typeof inline === "string" && inline.startsWith("http")) {
        return { imageUrl: inline, jobId, model: modelId };
      }
      throw new Error("Scenario edit completed but no asset URL found");
    }
    if (status === "failure" || status === "failed") {
      throw new Error(`Scenario edit failed: ${sj?.job?.statusMessage || sj?.error || "unknown"}`);
    }
  }
  throw new Error("Scenario edit timed out after 90s");
}
