<!-- Generated: 2026-03-07 | Files scanned: 86 | Token estimate: ~800 -->
# Frontend

## Page Tree
```
/                          → root layout
├── /login                 → LoginPage (auth form)
├── /setup                 → SetupPage (initial admin creation)
└── /dashboard             → DashboardShell (sidebar + header)
    ├── /                  → DashboardPage (overview)
    ├── /containers        → ContainersPage (Docker management)
    ├── /providers         → ProvidersPage (API keys, OAuth, custom)
    ├── /api-keys          → ApiKeysPage (user API keys)
    ├── /logs              → LogsPage (user logs)
    ├── /usage             → UsagePage (analytics + charts)
    ├── /monitoring        → MonitoringPage (service status + logs)
    ├── /quota             → QuotaPage (token quota + alerts)
    ├── /config            → ConfigPage (agent config editor)
    ├── /settings          → SettingsPage (updates, sync, sessions)
    └── /admin
        ├── /users         → AdminUsersPage
        └── /logs          → AdminLogsPage
```

## Component Hierarchy
```
DashboardShell
├── DashboardHeader (proxy status)
├── DashboardNav (sidebar, 274 lines)
│   └── UserPanel (user info, password, logout)
├── MobileTopBar + MobileSidebarContext
└── [Page Content]
    ├── SettingsPage → TelegramSettings, ProviderSettings, PasswordSettings
    ├── ProvidersPage → OAuthSection, ApiKeySection, CustomProviderSection, PerplexityProSection
    ├── QuotaPage → QuotaChart, QuotaDetails, QuotaAlerts
    ├── ConfigPage → AgentConfigEditor, ConfigPreview, ConfigFields
    ├── MonitoringPage → ServiceStatus, UsageStats, LiveLogs
    ├── UsagePage → UsageCharts, UsageTable, TimeFilter
    └── SetupPage → StepIndicator, StepContents, SuccessBanner, RevealBox
```

## UI Primitives (components/ui/)
Button, Card, Input, Modal, Toast, Tooltip, Breadcrumbs, ConfirmDialog, ChartTheme

## State Management
- useState/useReducer per page (no global store)
- All fetch via `fetch()` with `API_ENDPOINTS.*` constants
- AbortController cleanup in useEffect
- useFocusTrap hook for modal accessibility

## Config Generators
```
OpenCodeConfigGenerator (429 lines)
├── PluginSection, McpSection, ConfigPreview

OhMyOpenCodeConfigGenerator (630 lines)
├── TierAssignments, ToggleSections
│   └── 9 section components (LSP, Hooks, Tmux, BgTasks, etc.)
```

## Hooks
- use-focus-trap.ts: Modal/dialog focus trapping
- use-update-check.ts: Dashboard update polling
- use-proxy-update-check.ts: Proxy update polling

## Charts
Recharts (LineChart, AreaChart, PieChart) with shared ChartTheme
