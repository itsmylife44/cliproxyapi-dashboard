import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020";

import omoSchema from "@/lib/config-generators/upstream/oh-my-opencode.schema.json";
import slimSchema from "@/lib/config-generators/upstream/oh-my-opencode-slim.schema.json";

// OMO ships a draft-07 schema, slim a draft 2020-12 one.
const validators = {
  omo: new Ajv({ allErrors: true, strict: false, validateFormats: false }).compile(omoSchema),
  slim: new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(slimSchema),
};

/** Validates a generated config against the vendored upstream schema; returns readable errors (empty = valid). */
export function upstreamSchemaErrors(kind: keyof typeof validators, config: unknown): string[] {
  const validate = validators[kind];
  if (validate(config)) return [];
  return (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message} ${JSON.stringify(e.params)}`);
}
