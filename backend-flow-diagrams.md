# AI Fashion Studio — Backend Flow Diagrams (S1 → Final)





## 1) Big Picture (components & data flow)

```mermaid
%%{init: {'flowchart': {'htmlLabels': false}} }%%
flowchart TD
  %% External systems only to show backend boundaries
  subgraph EXT[External Systems]
    PP[(PayPal\nSandbox/Live)]
  end

  subgraph INFRA[Infra]
    P[(PostgreSQL)]
    R[Redis\nBullMQ]
    B[(Azure Blob Storage)]
    LOG[(Logs/Tracing)]
  end

  subgraph PY[Python Microservices - FastAPI]
    REC[rec-svc\nEmbeddings + FAISS\n/search/* /rebuild /health]
    SEG[seg-svc\nSegmentation -> mask\n/segmentation /health]
    VTO[vto-svc\nWarp + Inpaint\n/tryon /health]
    REG[regress-svc\nSales predict + eval\n/predict /eval /health]
  end

  subgraph GW[NestJS Gateway - backend-ts]
    direction TB
    AUTH[Auth Module\nJWT/RBAC\n/api/auth/*]
    FILES[Files Module\nPresign SAS\n/api/files/presign]
    SEARCH[Search Module\nProxy -> rec-svc\n/api/search/*]
    CV[CV Module\nProxy -> seg/vto\n/api/cv/*]
    ANALYTICS[Analytics Module\nProxy -> regress-svc\n/api/analytics/*]
    JOBS[Jobs Module\nBullMQ workers\n/api/jobs/*]
    PAY[PayPal Module\nCreate/Capture/Webhook\n/api/paypal/*]
    ADMIN[Admin/Health/Docs\n/api/admin/* /api/health]
  end

  %% Data lines
  GW -- SQL --> P
  GW -- cache/queue --> R
  FILES -- SAS URLs --> B
  SEG -- writes/reads --> B
  VTO -- writes --> B
  GW -- logs/metrics --> LOG

  %% Service calls
  SEARCH <--> REC
  CV <--> SEG
  CV <--> VTO
  ANALYTICS <--> REG
  PAY <--> PP

  %% Internal calls
  AUTH --- GW
  FILES --- GW
  SEARCH --- GW
  CV --- GW
  ANALYTICS --- GW
  JOBS --- GW
  PAY --- GW
  ADMIN --- GW
```

---

## 2) Auth (JWT) – Login/Verify

```mermaid
sequenceDiagram
  participant GW as Gateway: Auth
  participant P as Postgres

  GW->>P: SELECT * FROM users WHERE email=?
  P-->>GW: user + passwordHash + role
  GW->>GW: bcrypt.compare(password, hash)
  alt ok
    GW->>GW: sign JWT (sub, role, exp)
    GW-->>GW: store audit log (LOGIN)
  else bad
    GW-->>GW: raise 401
  end
```

---

## 3) File Presign → Upload to Azure

```mermaid
sequenceDiagram
  participant GW as Gateway: Files
  participant B as Azure Blob
  participant P as Postgres

  GW->>B: Build SAS (container, blob, contentType, expiry)
  B-->>GW: presigned PUT URL
  GW-->>P: INSERT file row (pending/meta)
  GW-->>GW: return { url }
```

---

## 4) Image/Text/Hybrid Search (Gateway → rec-svc)

```mermaid
sequenceDiagram
  participant GW as Gateway: Search
  participant REC as rec-svc
  participant R as Redis
  participant P as Postgres

  GW->>REC: POST /search/(image|text|hybrid) {imageUrl|query, topK, alpha?}
  REC-->>GW: {results:[{id,score,title,image}...]}
  GW->>P: INSERT search_log (type, params, results, latency)
  GW-->>GW: return results
```

---

## 5) Segmentation + Try-On Orchestration

```mermaid
sequenceDiagram
  participant GW as Gateway: CV
  participant SEG as seg-svc
  participant VTO as vto-svc
  participant B as Azure Blob
  participant P as Postgres
  participant R as Redis

  Note over GW: (Selfie & garment were uploaded via SAS already)

  GW->>SEG: POST /segmentation { imageUrl: garmentUrl }
  SEG-->>GW: { maskUrl }

  par small inputs
    GW->>VTO: POST /tryon { personUrl, garmentUrl, maskUrl }
    VTO-->>GW: { outputUrl }
  and heavy/queued
    GW->>R: enqueue tryon_job { personUrl, garmentUrl, maskUrl }
    R-->>GW: jobId
    GW->>GW: worker pulls job → calls VTO
    VTO-->>GW: { outputUrl }
  end

  GW->>P: INSERT tryon_job/result rows
  GW-->>GW: return { outputUrl or jobId }
```

---

## 6) Merchant Analytics (Gateway → regress-svc)

```mermaid
sequenceDiagram
  participant GW as Gateway: Analytics
  participant REG as regress-svc
  participant P as Postgres

  GW->>REG: POST /predict { imageUrl }
  REG-->>GW: { score, errLow, errHigh, heatmapUrl? }
  GW->>P: INSERT prediction row
  GW-->>GW: return payload
```

---

## 7) PayPal: Create → Approve → Capture (+Webhook)

```mermaid
sequenceDiagram
  participant GW as Gateway: PayPal
  participant PP as PayPal API
  participant P as Postgres

  Note over GW: getAccessToken() caches OAuth in memory (expires_in)

  GW->>PP: POST v2/checkout/orders { intent:CAPTURE, amount {value,currency} }
  PP-->>GW: { id, status:CREATED, links[approve] }
  GW-->>GW: return {id, approvalUrl}

  Note over GW: client opens approvalUrl and approves as sandbox buyer

  GW->>PP: POST v2/checkout/orders/{id}/capture
  PP-->>GW: { status:COMPLETED, purchase_units[0].payments.captures[] }
  GW->>P: INSERT payment {orderId, captureId, status, amount, currency, payload}
  GW-->>GW: return receipt

  %% Optional webhook (idempotent)
  PP-->>GW: POST /api/paypal/webhook (event)
  GW->>P: UPSERT payment/webhook_event; ensure idempotency
```

---

## 8) Jobs/Queues (BullMQ) for heavy tasks

```mermaid
sequenceDiagram
  participant API as Gateway: API
  participant R as Redis (Queue)
  participant W as Worker (Gateway)
  participant EXT as External Svc (seg/vto/…)
  participant P as Postgres

  API->>R: enqueue {type, payload}
  R-->>API: jobId
  W->>R: fetch job
  W->>EXT: call service with payload
  EXT-->>W: result / error
  W->>P: persist outcome
  W-->>API: (poll/notify) job status
```

---

## 9) Health/Observability/Rate-Limits

```mermaid
flowchart LR
  subgraph Gateway
    H1[/GET /api/health/]
    H2[/GET /api/admin/ping/]
    RL[Rate limiter\nper IP/JWT]
    LOG[Request ID + p50/p95 latency]
  end
  subgraph Services
    HR1[/rec-svc /health/]
    HR2[/seg-svc /health/]
    HR3[/vto-svc /health/]
    HR4[/regress-svc /health/]
  end
  H1-- probes -->HR1
  H1-- probes -->HR2
  H1-- probes -->HR3
  H1-- probes -->HR4
  Gateway-->LOG
  Gateway-->RL
```

---

## 10) Data persistence touchpoints (what the Gateway writes)

- **PostgreSQL**
  - `users` (auth), `files` (any uploaded/generated asset),  
    `search_log`, `tryon_job`, `segmentation_result`, `prediction`,
    `payment`, `webhook_event`, `audit_log`, `index_version`.
- **Redis**
  - BullMQ queues (e.g., `tryon`, `rebuild-index`) + short-lived caches (OAuth token, presign receipts).
- **Azure Blob**
  - `uploads/...` selfies & garments, `masks/...`, `tryon/...`, `heatmaps/...`.

---

### Notes
- Keep this file at `/docs/backend-flow.md` in your repo.
- Update only the relevant diagram when you add/modify endpoints.
- For sprint demos, show the matching sequence diagram (Search, Try-On, PayPal).
