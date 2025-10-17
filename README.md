flowchart TD
  subgraph UI[Next.js Web App]
    U1[Login]
    U2[Upload images]
    U3[Search (image/text/hybrid)]
    U4[Try-On wizard]
    U5[Merchant analytics]
    U6[Pay (PayPal)]
  end

  subgraph GW[NestJS Gateway (backend-ts)]
    A1[Auth (JWT/RBAC)]
    A2[Files: /api/files/presign → Azure SAS]
    A3[Jobs (BullMQ) + Redis]
    A4[Search Proxy /api/search/*]
    A5[CV Proxy /api/cv/* (seg + vto)]
    A6[Payments /api/paypal/*]
    A7[Admin/Health/Docs]
    A8[Metrics & Logs]
  end

  subgraph SVC[Python ML/CV Services (FastAPI)]
    direction TB
    REC[rec-svc\nCLIP/SigLIP + FAISS\n/search/image, /search/text, /search/hybrid, /rebuild]
    SEG[seg-svc\nSegmentation → mask\n/segmentation]
    VTO[vto-svc\nWarp+Inpaint → try-on\n/tryon]
    REG[regress-svc\nSales predict + eval\n/predict, /eval]
  end

  subgraph DATA[Infra]
    P[(PostgreSQL\nusers, payments, logs, jobs)]
    R[(Redis\nqueues, cache)]
    B[(Azure Blob Storage\nraw uploads, masks, try-on outputs)]
    PP[(PayPal Sandbox/Live)]
  end

  UI -->|JWT HTTP| GW
  GW <--> P
  GW <--> R
  A2 --> B
  SEG --> B
  VTO --> B

  A4 --> REC
  A5 --> SEG
  A5 --> VTO
  A6 --> PP

  GW --> A8
