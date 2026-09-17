# Checkout — payment retry flow

## Context

How a checkout charge is attempted, retried on transient failures, and what happens when attempts are exhausted. Refund handling is out of scope.

## Diagram

```mermaid
---
title: Checkout — Payment Retry Flow
---
flowchart LR
    client["Client"] -->|POST /checkout| gateway["API Gateway"]
    gateway -->|gRPC| checkout["Checkout Service"]
    checkout -->|charge| processor["Payment Processor"]
    processor -->|REST| psp["Payment Provider"]

    processor -->|transient error| queue["Retry Queue"]
    queue -->|retry with backoff| processor
    queue -->|max attempts| dlq["Dead Letter Queue"]
    dlq -->|alert| ops["On-call"]

    processor -->|success| ledger["Ledger"]
    processor -->|decline| checkout
    checkout -->|202 Accepted| client
```

## Notes

- Retry budget and backoff schedule are config-driven; dead letters page on-call.
