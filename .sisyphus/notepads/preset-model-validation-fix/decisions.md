# Decisions — preset-model-validation-fix

## Session: ses_296224370ffepX3zhIBnvec7iB (2026-04-07)

### Architectural Decisions
- Generated JSON skips unresolvable agents (CORRECT behavior — JSON must only have available models)
- UI must NOT mirror the JSON skip — agents always rendered from UPSTREAM_AGENT_CHAINS directly
- "unresolved" is UI-only concept — isUnresolved flag passed via props, not in JSON output
- Override models kept in state even when unavailable (user may add provider later)
- Toast uses existing showToast/useToast utility — no new notification system
