#!/bin/bash
# Seed demo events. Run with API on http://localhost:3001
API="${API:-http://localhost:3001}"
for i in 1 2 3; do
  curl -s -X POST "$API/v1/events" -H "Content-Type: application/json" -d "{
    \"workspace_id\": \"ws_default\",
    \"run_id\": \"run_demo\",
    \"agent\": { \"id\": \"agent_$i\", \"name\": \"agent-$i\", \"kind\": \"openclaw\" },
    \"event\": {
      \"type\": \"task_progress\",
      \"ts\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"dedupe_key\": \"agent_$i:task_1:step_0\",
      \"data\": { \"progress\": 0.$i, \"message\": \"Step $i\" }
    }
  }"
  echo ""
done
