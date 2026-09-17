# Flights Assistant — Worker agent loop

## Context

What a worker does after popping a job: identity/permission resolution, routing into a repo-scoped subagent, and the stateless LLM tool loop that ends in a cited answer or an escalation. Timeline view lives in `flights-assistant-event-flow.md`; component view in `flights-assistant-bot.d2`.

## Diagram

```mermaid
---
title: Flights Assistant — Worker agent loop
---
flowchart LR
    job["Job popped from Redis (locked)"] --> acl["ACL: Slack user → Okta email → GitLab groups"]
    acl --> sess["Load per-thread session (Redis, TTL 24h)"]
    sess --> router["Intent router (cheap LLM call)"]
    router --> sub["Domain subagent (flapi | fsa | mspa | bcre)"]
    sub --> think{"LLM requests a tool?"}
    think -->|yes| tool["Execute MCP tool — search_code, read_file, grafana_query"]
    tool --> think
    think -->|final answer| cite["Answer + mandatory citations"]
    cite --> post["Post to Slack thread"]
    think -->|round cap reached| esc["Escalate to on-call with findings"]
```

## Notes

- Every LLM round is one stateless HTTPS call carrying the full context — "the agent" is this loop plus the tool schemas, nothing more.
- Subagents start with fresh, repo-scoped context, so one team's data never bleeds into another's answer.
- Escalation is a first-class outcome: an honest "I don't know, here's who does" beats a confident wrong answer.
