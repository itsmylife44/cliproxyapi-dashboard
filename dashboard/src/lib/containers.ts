interface ContainerPermissions {
  displayName: string;
  allowStart: boolean;
  allowStop: boolean;
  allowRestart: boolean;
}

const apiContainer = process.env.CLIPROXYAPI_CONTAINER_NAME || "cliproxyapi";
const isDevMode = apiContainer.includes("-dev-");

const postgresContainer = isDevMode ? "cliproxyapi-dev-postgres" : "cliproxyapi-postgres";
const caddyContainer = "cliproxyapi-caddy";
const dashboardContainer = isDevMode ? "cliproxyapi-dashboard" : "cliproxyapi-dashboard";

export const CONTAINER_CONFIG: Record<string, ContainerPermissions> = {
  [apiContainer]: { displayName: "CLIProxyAPI", allowStart: true, allowStop: true, allowRestart: true },
  [postgresContainer]: { displayName: "PostgreSQL", allowStart: false, allowStop: false, allowRestart: false },
  ...(isDevMode ? {} : {
    [caddyContainer]: { displayName: "Caddy", allowStart: false, allowStop: false, allowRestart: true },
    [dashboardContainer]: { displayName: "Dashboard", allowStart: false, allowStop: false, allowRestart: false },
  }),
};

export const CONTAINER_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

const ACTION = {
  START: "start",
  STOP: "stop",
  RESTART: "restart",
} as const;

export type ContainerAction = (typeof ACTION)[keyof typeof ACTION];

export function isValidContainerName(name: string): name is keyof typeof CONTAINER_CONFIG {
  return CONTAINER_NAME_PATTERN.test(name) && name in CONTAINER_CONFIG;
}

export function getAllowedActions(containerName: string, state: string): ContainerAction[] {
  const config = CONTAINER_CONFIG[containerName];
  if (!config) return [];

  const actions: ContainerAction[] = [];

  if (config.allowStart && state !== "running" && state !== "restarting") {
    actions.push(ACTION.START);
  }
  if (config.allowStop && (state === "running" || state === "restarting" || state === "paused")) {
    actions.push(ACTION.STOP);
  }
  if (config.allowRestart && (state === "running" || state === "restarting" || state === "paused")) {
    actions.push(ACTION.RESTART);
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Container detail helpers (used by /api/containers/[name]/details)
// ---------------------------------------------------------------------------

export interface ContainerPort {
  containerPort: number;
  protocol: "tcp" | "udp";
  hostIp?: string;
  hostPort?: number;
}

export interface ContainerMount {
  type: "bind" | "volume" | "tmpfs";
  source: string;
  destination: string;
  readOnly: boolean;
}

type HealthStatus = "healthy" | "unhealthy" | "starting" | "none";

export function normalizeHealthStatus(raw: string): HealthStatus {
  const lower = raw.toLowerCase().trim();
  if (lower === "healthy") return "healthy";
  if (lower === "unhealthy") return "unhealthy";
  if (lower === "starting") return "starting";
  return "none";
}

export function extractEnvKeys(envArray: string[]): string[] {
  return envArray.map((entry) => {
    const eqIdx = entry.indexOf("=");
    return eqIdx === -1 ? entry : entry.slice(0, eqIdx);
  });
}

export function parseRestartInfo(
  restartCount: number,
  exitCode?: number,
  error?: string,
): { restartCount: number; exitCode?: number; error?: string } {
  return {
    restartCount,
    ...(exitCode !== undefined && { exitCode }),
    ...(error && { error }),
  };
}

export function parseServiceLabels(
  labels: Record<string, string>,
): { project?: string; service?: string; version?: string } {
  return {
    ...(labels["com.docker.compose.project"] && { project: labels["com.docker.compose.project"] }),
    ...(labels["com.docker.compose.service"] && { service: labels["com.docker.compose.service"] }),
    ...(labels["org.opencontainers.image.version"] && { version: labels["org.opencontainers.image.version"] }),
  };
}
