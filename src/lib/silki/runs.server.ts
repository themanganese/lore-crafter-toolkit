// In-memory run-event store. Survives within a single Worker process; client polls via getRunEvents.
import type { ThoughtEvent, ThoughtAgent, ThoughtStatus } from "../types";

export type RunResult = Record<string, unknown> | null;

type Run = {
  id: string;
  events: ThoughtEvent[];
  startedAt: number;
  done: boolean;
  result?: RunResult;
};

const runs = new Map<string, Run>();
const MAX_RUNS = 32;

export function startRun(): string {
  // GC oldest if too many
  if (runs.size >= MAX_RUNS) {
    const oldest = [...runs.values()].sort((a, b) => a.startedAt - b.startedAt)[0];
    if (oldest) runs.delete(oldest.id);
  }
  const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  runs.set(id, { id, events: [], startedAt: Date.now(), done: false });
  return id;
}

export function emit(runId: string, agent: ThoughtAgent, message: string, status: ThoughtStatus = "in_progress"): void {
  const run = runs.get(runId);
  if (!run) return;
  run.events.push({
    id: `${run.events.length + 1}`,
    agent,
    message,
    status,
    ts: new Date().toISOString(),
  });
}

export function complete(runId: string, agent: ThoughtAgent, message: string): void {
  emit(runId, agent, message, "done");
}

export function fail(runId: string, agent: ThoughtAgent, message: string): void {
  emit(runId, agent, message, "error");
  const run = runs.get(runId);
  if (run) run.done = true;
}

export function finishRun(runId: string): void {
  const run = runs.get(runId);
  if (run) run.done = true;
}

export function getEvents(runId: string): { events: ThoughtEvent[]; done: boolean } {
  const run = runs.get(runId);
  if (!run) return { events: [], done: true };
  return { events: run.events, done: run.done };
}

export function setResult(runId: string, result: RunResult): void {
  const run = runs.get(runId);
  if (run) run.result = result;
}

export function getResult(runId: string): { done: boolean; result: RunResult } {
  const run = runs.get(runId);
  if (!run) return { done: true, result: null };
  return { done: run.done, result: run.result ?? null };
}
