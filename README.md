# Openclaw Control Plane

A visual orchestration and observability layer for AI agents. Self-hosted, open-source MVP.

## Quick Start

### Docker (recommended)

```bash
cd control-plane
docker compose up --build
```

- **Web UI**: http://localhost:3000  
- **API**: http://localhost:3001  

### Local development

```bash
cd control-plane
pnpm install
pnpm run dev:api    # Terminal 1: API on :3001
pnpm run dev:web    # Terminal 2: Web on :3000
```

## API

### Ingest events

```bash
curl -X POST http://localhost:3001/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "ws_default",
    "run_id": "run_demo",
    "agent": { "id": "agent_1", "name": "planner", "kind": "openclaw" },
    "event": {
      "type": "task_progress",
      "ts": "2026-02-21T14:05:00Z",
      "dedupe_key": "agent_1:task_99:step_3",
      "data": { "task_id": "task_99", "progress": 0.6, "message": "Drafting architecture" }
    }
  }'
```

### Graph

```bash
curl "http://localhost:3001/v1/workspaces/ws_default/graph?run_id=run_demo"
```

### SSE stream

Connect to `GET /v1/stream?workspace_id=ws_default` for real-time updates.

## Seed demo data

```bash
./scripts/seed-events.sh
```

## OpenClaw adapter

Syncs OpenClaw session logs to the Control Plane. Polls `agents/<name>/sessions/*.jsonl` and maps events to the API.

**Setup:** Set `OPENCLAW_SESSIONS_DIR` (path to `agents` folder) or create `apps/openclaw-adapter/config.json`:

```json
{ "sessions_dir": "/Users/you/.openclaw/agents" }
```

**Run:**

```bash
OPENCLAW_SESSIONS_DIR=/path/to/agents pnpm run adapter
```

Set `RUN_ID=run_demo` to have OpenClaw agents appear in the default UI run. Ensure the API is running on port 3001.

## Data

Events are stored under `data/workspaces/<workspace_id>/runs/<run_id>/`:

- `events.jsonl` – append-only event log  
- `agents_state.json` – current agent state  
- `dedupe_index.json` – idempotency index  

When running locally, data is stored in `apps/api/data/` (relative to API cwd).

## License

Apache 2.0
