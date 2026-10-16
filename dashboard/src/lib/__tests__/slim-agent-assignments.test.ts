import { describe, expect, it } from "vitest";

import { buildSlimAgentAssignments } from "../config-generators/oh-my-opencode-slim-assignments";
import type { SlimAgentConfig } from "../config-generators/oh-my-opencode-slim-types";

const available = ["claude-opus-4-6", "gemini-2.5-flash"];

function cardFor(agent: string, agents: Record<string, SlimAgentConfig>, inheritedFrom?: string) {
  const cards = buildSlimAgentAssignments({
    agents,
    availableModelIds: available,
    inheritedFrom,
    resolveParentModel: () => "parent-model",
    inheritedModelLabel: "inherited",
  });
  return cards.find((card) => card.name === agent);
}

describe("buildSlimAgentAssignments", () => {
  it("shows no auto-picked model for an agent that inherits its model from the session", () => {
    const card = cardFor("fixer", { fixer: { inheritModelFrom: "session" } });

    expect(card).toMatchObject({ model: "inherited", inheritsModelFrom: "session", isOverride: false });
  });

  it("shows the orchestrator inheritance, not the parent preset's model, inside an extending preset", () => {
    const card = cardFor("oracle", { oracle: { inheritModelFrom: "orchestrator" } }, "base");

    expect(card).toMatchObject({ model: "inherited", inheritsModelFrom: "orchestrator", isOverride: false });
    expect(card?.inheritedFrom).toBeUndefined();
  });

  it("keeps inheriting when the model is an array, since slim uses the array only as a fallback", () => {
    const card = cardFor("fixer", { fixer: { inheritModelFrom: "session", model: ["openai/gpt-5"] } });

    expect(card).toMatchObject({ model: "inherited", inheritsModelFrom: "session", isOverride: false });
  });

  it("lets a scalar model beat inheritance", () => {
    const card = cardFor("fixer", { fixer: { inheritModelFrom: "session", model: "openai/gpt-5" } });

    expect(card).toMatchObject({ model: "openai/gpt-5", isOverride: true });
    expect(card?.inheritsModelFrom).toBeUndefined();
  });

  it("shows an external model as the configured override instead of an auto-pick", () => {
    const card = cardFor("fixer", { fixer: { model: "openai/gpt-5" } });

    expect(card).toMatchObject({ model: "openai/gpt-5", isOverride: true, isUnresolved: false });
  });

  it("shows the parent preset's model for an unset agent in an extending preset", () => {
    const card = cardFor("fixer", {}, "base");

    expect(card).toMatchObject({ model: "parent-model", inheritedFrom: "base", isOverride: false });
  });

  it("auto-picks a model for an unset agent outside an extending preset", () => {
    const card = cardFor("orchestrator", {});

    expect(card).toMatchObject({ model: "claude-opus-4-6", isOverride: false, isUnresolved: false });
  });

  it("shows the primary entry of an array model", () => {
    const card = cardFor("fixer", { fixer: { model: [{ id: "openai/gpt-5", variant: "high" }, "claude-opus-4-6"] } });

    expect(card).toMatchObject({ model: "openai/gpt-5", isOverride: true });
  });
});
