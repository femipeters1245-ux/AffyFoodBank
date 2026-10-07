# Food Bank Backend

This is the **backend** for the Food Bank marketplace. It is built with **Node.js**, **TypeScript**, **Express**, and **Prisma** for ORM and migrations.

## Main Features
- RESTful API with versioning (`/api/v1/...`).
- JWT based authentication.
- Role‑Based Access Control (RBAC) using a flexible permission system.
- Comprehensive error handling and logging.
- Clean separation of concerns: routes, controllers, services, data‑access (Prisma), and middleware.
- Environment‑driven configuration – all secrets and feature flags live in `.env` files.

## Folder Structure
```
backend/
│   package.json
│   tsconfig.json
│   .env.example
│
├─ src/
│   ├─ index.ts                # App entry point
│   ├─ server.ts                # Server creation & startup
│   ├─ config/
│   │   └─ env.ts               # Load & validate environment variables
│   ├─ middleware/
│   │   ├─ auth.ts              # JWT verification & user context
│   │   └─ errorHandler.ts      # Central error formatter
│   ├─ routes/
│   │   ├─ auth.ts              # /auth/* – login, register, password reset
│   │   ├─ users.ts             # /users/* – profile, addresses
│   │   ├─ products.ts          # /products/* – CRUD, search, filter
│   │   ├─ packages.ts          # /packages/* – predefined bundles
│   │   ├─ wallet.ts            # /wallet/* – balance, history
│   │   ├─ savings.ts           # /savings/* – goals, contributions
│   │   ├─ orders.ts            # /orders/* – creation, status workflow
│   │   ├─ payments.ts           # /payments/* – deposit flow, webhook
│   │   ├─ notifications.ts     # /notifications/* – inbox, preferences
│   │   └─ logistics.ts         # /logistics/* – delivery handling
│   ├─ services/
│   │   ├─ authService.ts
│   │   ├─ userService.ts
│   │   ├─ productService.ts
│   │   ├─ packageService.ts
│   │   ├─ walletService.ts
│   │   ├─ savingsService.ts
│   │   ├─ orderService.ts
│   │   ├─ paymentService.ts
│   │   ├─ notificationService.ts
│   │   └─ logisticsService.ts
│   └─ prisma/
│       ├─ schema.prisma       # Prisma data model – source of migrations
│       └─ migrations/          # Auto‑generated migration SQL files
│
└─ tests/
    └─ integration/            # End‑to‑end API tests (Jest + SuperTest)
```

## Development, Testing & Production Config
- **development** – `npm run dev` runs `ts-node-dev` with `.env.development`.
- **test** – `npm run test` loads `.env.test`.
- **production** – `npm start` expects a compiled `dist/` folder and `.env.production`.

All three env files are listed in `.env.example`.

---

### Getting Started
```bash
# clone the repo (you already have the code)
cd backend
npm install
# generate the Prisma client and apply migrations
npx prisma migrate dev --name init
npm run dev
```
The API will be reachable at `http://localhost:3000/api/v1/`.

---

For detailed API contracts, see **docs/API_SPEC.md**.
