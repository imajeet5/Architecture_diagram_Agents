# Payments Platform — Architecture

## Context

Service map for the payments platform: how client traffic reaches the payments service, and how charges flow to the ledger and external payment rails. Fraud scoring and reconciliation jobs are out of scope.

## Diagram

```mermaid
---
title: Payments Platform — Architecture
---
flowchart LR
    client["Client apps"] -->|HTTPS| cdn["CDN"]
    cdn -->|HTTPS| gateway["API Gateway"]
    gateway -->|gRPC| api["Payments API"]

    api -->|route| router["Router"]
    router -->|charge| processor["Processor"]
    processor -->|double-entry| ledger["Ledger"]
    ledger -->|SQL| db[("Postgres")]
    api -->|publish| bus["Kafka"]

    processor -->|REST| psp["Payment Provider"]
    processor -->|ACH / SWIFT| bank["Bank Rails"]
```

## Notes

- Ledger is the source of truth; the processor never mutates balances directly.
