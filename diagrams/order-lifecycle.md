# Order lifecycle — state machine

## Context

States an order moves through from creation to terminal state, and the events that trigger transitions. Inventory reservation is not modeled here.

## Diagram

```mermaid
---
title: Order Lifecycle
---
stateDiagram-v2
    [*] --> Created
    Created --> Paid : payment.captured
    Created --> Cancelled : user cancels / timeout
    Paid --> Fulfilling : warehouse picks
    Fulfilling --> Shipped : carrier scan
    Shipped --> Delivered : proof of delivery
    Delivered --> Returned : return window
    Returned --> Refunded : refund issued
    Cancelled --> Refunded : refund issued
    Delivered --> [*]
    Refunded --> [*]
```
