# <System name> — <diagram type>

## Context

<2–3 lines: what this diagram explains, who it is for, and what is deliberately out of scope.>

## Diagram

```mermaid
---
title: <System name> — <diagram type>
---
flowchart LR
    client["Client"] -->|HTTPS| gateway["API Gateway"]
    gateway -->|gRPC| service["Core Service"]
    service -->|SQL| db[("Database")]
    service -->|publish| queue["Queue"]

    subgraph thirdparty["Third parties"]
        external["External API"]
    end

    service -->|REST| external
```

## Notes

- <key decision, caveat, or link to a related diagram>
