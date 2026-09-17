# Flights Assistant — Event flow (mention to answer)

## Context

End-to-end flow for a single question: what happens after a developer tags `@flights-assistant` until the answer lands in the thread, including the 3-second ack rule and the queue handoff. Out of scope: MCP tool internals and deployment topology — see `flights-assistant-bot.d2` and `flights-assistant-network.d2`.

## Diagram

```mermaid
---
title: Flights Assistant — Event flow (mention to answer)
---
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant Slack as Slack cloud
    participant Rx as Receiver (Bolt, Socket Mode)
    participant Q as Redis (queue + sessions)
    participant W as Worker
    participant LLM as LLM API
    participant MCP as MCP tools (code, Grafana, GitLab)

    Dev->>Slack: @flights-assistant "how does price change happen?"
    Slack--)Rx: app_mention over open WebSocket (auto-acked)
    Rx->>Slack: thread reply "Digging into it…"
    Rx->>Q: enqueue job {channel, thread_ts, user, text}
    Note over Rx: listener returns in ms (3s ack rule)
    Q--)W: job popped (wait → active, locked)
    W->>Q: load thread session (TTL 24h)
    loop Agent loop — max 12 rounds
        W->>LLM: chat(messages, tools) — stateless HTTPS
        alt LLM requests tools
            LLM--)W: tool calls
            W->>MCP: execute tool
            MCP--)W: results (code, dashboards, logs)
        else LLM returns the answer
            LLM--)W: final answer with citations
        end
    end
    W->>Slack: post answer (sources, 👍/👎, Escalate)
    W->>Q: complete job · save session
    Dev->>Slack: clicks 👍 or Escalate
    Slack--)Rx: block_actions over same WebSocket
    Note over Rx: ack() within 3s, then enqueue
    Rx->>Q: enqueue feedback / escalation job
```

## Notes

- The receiver never calls the LLM; the worker never touches Slack's socket — Redis is the only shared boundary between them.
- If a worker dies mid-job, its lock expires and BullMQ returns the job to the queue for another worker.
- Slack retries un-acked events; using `jobId = event_id` makes those retries harmless.
