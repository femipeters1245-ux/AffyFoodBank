# Food Bank Marketplace

This repository contains the foundational architecture for the **Food Bank** web application – a Nigerian raw‑foodstuff marketplace combined with a food‑savings platform.

## Table of Contents
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Environment Variables](#environment-variables)
- [Database](#database)
  - [Schema (SQL Migration)](#schema-sql-migration)
  - [Prisma Schema (optional)](#prisma-schema-optional)
- [Backend](#backend)
  - [API Design](#api-design)
  - [Authentication & Authorization](#authentication--authorization)
  - [Error Handling](#error-handling)
- [Frontend](#frontend)
  - [Routing & State Management](#routing--state-management)
  - [Styling](#styling)
- [Testing](#testing)
- [Next Steps](#next-steps)

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + Vite, TypeScript, React Router, Redux Toolkit (or TanStack Query), **Poppins** font, CSS Modules / TailwindCSS |
| **Backend/API** | Node.js 20, Express, TypeScript, **JWT** for authentication, **Bcrypt** for password hashing |
| **Database** | PostgreSQL 15, Prisma ORM (optional) or plain SQL migrations |
| **Testing** | Jest & React Testing Library (frontend), Jest + Supertest (backend), PostgreSQL test container |
| **CI/CD** | GitHub Actions (run lint, type‑check, tests) |
| **Configuration** | `dotenv` + environment variables, separate `.env.development`, `.env.test`, `.env.production` |
| **Payments** | Integration placeholder for **Transactpay** (implemented later) |

---

## Folder Structure
```
FoodBank/                     # repository root
├─ README.md                 # this file
├─ .env.example              # sample env vars (do NOT commit secrets)
├─ package.json              # root (optional workspace manager)
├─ tsconfig.json             # root TypeScript config
├─ docs/
│   └─ architecture.md      # detailed architecture description
├─ backend/
│   ├─ src/
│   │   ├─ index.ts          # entry point – Express server
│   │   ├─ app.ts            # Express app configuration
│   │   ├─ config/
│   │   │   └─ index.ts      # loads env vars, validation (zod)
│   │   ├─ routes/
│   │   │   ├─ auth.ts       # /auth – register, login, logout, reset
│   │   │   ├─ users.ts       # CRUD for user profiles (admin only)
│   │   │   ├─ products.ts   # product catalogue endpoints
│   │   │   ├─ packages.ts    # package endpoints
│   │   │   ├─ wallets.ts     # wallet & transaction endpoints
│   │   │   ├─ savings.ts     # savings‑plan endpoints
│   │   │   ├─ orders.ts      # order lifecycle endpoints
│   │   │   ├─ deliveries.ts  # logistics endpoints
│   │   │   └─ notifications.ts
│   │   ├─ middleware/
│   │   │   ├─ auth.ts        # JWT verification, role extraction
│   │   │   ├─ permission.ts  # permission‑based guard
│   │   │   └─ errorHandler.ts
│   │   ├─ services/
│   │   │   ├─ authService.ts # password hashing, token creation
│   │   │   ├─ walletService.ts# ledger‑safe balance updates
│   │   │   └─ paymentService.ts (stub for Transactpay)
│   │   └─ utils/
│   │       └─ logger.ts       # winston logger wrapper
│   ├─ migrations/            # raw SQL migrations (run with npm script)
│   │   └─ 001_initial_schema.sql
│   ├─ prisma/                # optional – Prisma schema & client generation
│   │   └─ schema.prisma
│   ├─ tests/                # Jest & Supertest integration tests
│   │   └─ auth.test.ts
│   ├─ Dockerfile
│   └─ tsconfig.json
├─ frontend/
│   ├─ public/
│   │   └─ index.html
│   ├─ src/
│   │   ├─ index.tsx        # React entry point
│   │   ├─ App.tsx          # Route definitions
│   │   ├─ api/             # thin wrappers around backend REST endpoints
│   │   ├─ features/        # e.g., products/, packages/, wallet/, savings/
│   │   ├─ components/      # reusable UI components (Header, Card, Modal, …)
│   │   ├─ hooks/           # custom data‑fetching hooks
│   │   └─ styles/          # global CSS, Poppins import, Tailwind config
│   ├─ package.json
│   ├─ tsconfig.json
│   └─ vite.config.ts
└─ .github/
    └─ workflows/
        └─ ci.yml          # lint, type‑check, tests
```

---

## Environment Variables
Create a file `backend/.env` (or use the root `.env`) based on **.env.example**.  All secrets are loaded via `dotenv` and validated with **zod**.

```dotenv
# ----- Core -----
NODE_ENV=development                # development | test | production
PORT=4000
BASE_URL=http://localhost:4000

# ----- Database -----
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=foodbank
POSTGRES_USER=foodbank_user
POSTGRES_PASSWORD=securepassword

# ----- JWT -----
JWT_SECRET=super_secret_jwt_key
JWT_EXPIRES_IN=7d                # token lifetime

# ----- Bcrypt -----
BCRYPT_SALT_ROUNDS=12

# ----- Transactpay (placeholder) -----
TRANSACTPAY_API_KEY=your_api_key
TRANSACTPAY_BASE_URL=https://api.transactpay.com/v1
TRANSACTPAY_CALLBACK_URL=https://yourdomain.com/api/payments/callback
TRANSACTPAY_WEBHOOK_URL=https://yourdomain.com/api/payments/webhook
TRANSACTPAY_ENVIRONMENT=TEST   # TEST or PRODUCTION
```

**Never commit the real `.env` file.** The `.env.example` contains the same keys with placeholder values.

---

## Database
### Schema (SQL Migration)
The migration file `backend/migrations/001_initial_schema.sql` defines all core tables, constraints, indexes, and timestamps.  It is written for PostgreSQL.

```sql
-- backend/migrations/001_initial_schema.sql

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- Users, Roles, Permissions
-- ================================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    description TEXT,
    UNIQUE (action, resource),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Customer specific data
-- ================================================================
CREATE TABLE customer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
    line1 VARCHAR(255) NOT NULL,
    line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Product catalogue
-- ================================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    symbol VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE,
    price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL CHECK (quantity >= 0),
    low_stock_threshold NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Packages (pre‑defined bundles)
-- ================================================================
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, DELETED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE package_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID REFERENCES packages(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (package_id, product_id, unit_id)
);

-- ================================================================
-- Wallet & Financial Ledger
-- ================================================================
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID UNIQUE REFERENCES customer_profiles(id) ON DELETE CASCADE,
    total_balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (total_balance_cents >= 0),
    allocated_to_savings_cents BIGINT NOT NULL DEFAULT 0 CHECK (allocated_to_savings_cents >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TYPE transaction_type AS ENUM (
    'DEPOSIT',
    'WITHDRAWAL',
    'SAVINGS_ALLOCATION',
    'SAVINGS_RELEASE',
    'PURCHASE',
    'REFUND',
    'ADJUSTMENT'
);

CREATE TYPE transaction_status AS ENUM (
    'PENDING',
    'SUCCESSFUL',
    'FAILED',
    'REVERSED'
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers_profiles(id) ON DELETE CASCADE,
    reference VARCHAR(100) NOT NULL UNIQUE,
    type transaction_type NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('IN', 'OUT')),
    status transaction_status NOT NULL DEFAULT 'PENDING',
    description TEXT,
    payment_reference VARCHAR(100), -- optional link to external provider
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Savings Plans (custom & predefined)
-- ================================================================
CREATE TYPE savings_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'TARGET_REACHED',
    'PURCHASE_CONFIRMED',
    'COMPLETED',
    'CANCELLED'
);

CREATE TABLE savings_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    target_amount_cents BIGINT NOT NULL CHECK (target_amount_cents > 0),
    amount_saved_cents BIGINT NOT NULL DEFAULT 0 CHECK (amount_saved_cents >= 0),
    target_date DATE NOT NULL,
    status savings_status NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE savings_plan_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    savings_plan_id UUID REFERENCES savings_plans(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (savings_plan_id, product_id, unit_id)
);

CREATE TABLE savings_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    savings_plan_id UUID REFERENCES savings_plans(id) ON DELETE CASCADE,
    wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE RESTRICT,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Orders & Order Items
-- ================================================================
CREATE TYPE order_status AS ENUM (
    'PENDING',
    'PROCESSING',
    'READY_FOR_DISPATCH',
    'DISPATCHED',
    'IN_TRANSIT',
    'DELIVERED',
    'FAILED',
    'CANCELLED'
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
    total_amount_cents BIGINT NOT NULL CHECK (total_amount_cents > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    status order_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
    price_at_purchase_cents BIGINT NOT NULL CHECK (price_at_purchase_cents >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Logistics (Deliveries)
-- ================================================================
CREATE TYPE delivery_status AS ENUM (
    'PENDING',
    'ASSIGNED',
    'READY_FOR_DISPATCH',
    'DISPATCHED',
    'IN_TRANSIT',
    'DELIVERED',
    'FAILED'
);

CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    driver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
    status delivery_status NOT NULL DEFAULT 'PENDING',
    proof_of_delivery_url TEXT,
    notes TEXT,
    estimated_delivery_at TIMESTAMP WITH TIME ZONE,
    actual_delivery_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Notifications
-- ================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID REFERENCES customer_profiles(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_profile_id UUID UNIQUE REFERENCES customer_profiles(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL, -- EMAIL, SMS, PUSH
    frequency VARCHAR(20) NOT NULL DEFAULT 'DAILY',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ================================================================
-- Audit Logs (sensitive actions)
-- ================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(200) NOT NULL,
    target_table VARCHAR(100),
    target_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for fast look‑ups
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_profile_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_notifications_customer_id ON notifications(customer_profile_id);
```

The migration can be executed with a simple script (`npm run db:migrate`) that uses `psql` or a Node migration library (e.g., **node‑pg‑migrate**).

### Prisma Schema (optional)
If you prefer Prisma, the same definitions can be expressed in `backend/prisma/schema.prisma`.  The file is included but left empty for now – developers may generate it from the SQL using `prisma db pull`.

---

## Backend
### API Design
- **Versioning** – All routes are under `/api/v1/`.
- **RESTful resources** – `GET /products`, `POST /orders`, etc.
- **Pagination** – `?page=&limit=` pattern on list endpoints.
- **Filtering** – `?category=`, `?price_min=&price_max=`, `?search=`.
- **Error format** – JSON: `{ "error": "Message", "code": "ERR_CODE", "details": {...} }` with proper HTTP status codes.

### Authentication & Authorization
1. **Registration** – POST `/auth/register` → creates a user, assigns `Customer` role, hashes password with Bcrypt, creates `customer_profile` and a wallet.
2. **Login** – POST `/auth/login` → validates credentials, returns signed JWT with `roleId` and `permissions` claims.
3. **JWT Middleware** – Verifies token, attaches `req.user` (id, role, permissions).
4. **Permission Guard** – Each route defines required permission strings (e.g., `product:create`). Middleware checks `req.user.permissions`.
5. **Refresh / Logout** – Stateless JWT; logout is client‑side by discarding the token. A short‑lived access token + optional refresh token can be added later.

### Error Handling
- Central `errorHandler` middleware formats errors.
- Custom error classes (`BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`).
- Unexpected errors are logged with stack traces and return generic `500` to client.

---

## Frontend
- **Routing** – React Router v6; protected routes use a `RequireAuth` component that checks JWT and required permissions.
- **State** – TanStack Query for server state, Redux Toolkit for UI state (e.g., basket, notifications).
- **Styling** – TailwindCSS with the **Poppins** font imported from Google Fonts.  Colors will follow the brand palette (to be extracted from the uploaded logo later).
- **Responsive Design** – Mobile‑first breakpoints (sm, md, lg).  Layout components adapt to tablet and desktop.
- **API Layer** – Thin wrappers (`api/products.ts`, `api/orders.ts`, …) that automatically attach the JWT from localStorage and handle 401/403 globally.
- **Forms** – React Hook Form with Yup validation for registration, login, checkout, etc.
- **Error UI** – Global toast system for API errors, field‑level validation messages.

---

## Testing
- **Backend** – Jest + Supertest for API integration tests.  Tests cover: auth flow, RBAC, CRUD constraints, transaction safety (wallet updates within DB transaction), inventory oversell protection.
- **Frontend** – React Testing Library for component rendering, mock API calls with MSW (Mock Service Worker).
- **E2E (optional)** – Playwright / Cypress to exercise the full checkout flow including mock Transactpay webhook.

---

## Next Steps
1. **Run the initial migration** – `npm run db:migrate` (creates all tables).
2. **Seed essential lookup data** – units (`kg`, `cong`, `bag`, `bottle`, `keg`, `piece`), default roles & permissions.
3. **Implement authentication routes** (register, login, password reset stub).
4. **Create middleware** for JWT validation and permission checks.
5. **Develop product & inventory services** – ensure stock cannot be oversold (use `SELECT … FOR UPDATE`).
6. **Wire up wallet service** – atomic balance updates with ledger entries.
7. **Expose frontend scaffolding** – `npm run dev` should serve the Vite dev server.
8. **Add CI pipeline** – lint, type‑check, run tests on push.
9. **Finalize brand assets** – replace placeholder colors/fonts with those from the uploaded logo.
10. **Later** – Implement Transactpay integration (Prompt 8), payment service, and reconciliation tools.

---

## System Verification Report (Template)
A Markdown artifact will be generated after the first round of development to capture:
- Completed modules
- API endpoints list
- Database entities & relationships diagram (Mermaid ERD)
- Role‑permission matrix
- Security controls summary
- Known limitations
- Configuration checklist
- Deployment checklist (Docker, CI, env vars)

*The report will be placed in `docs/verification_report.md` once the above steps are verified.*

---

*All code files are intentionally minimal – they provide the scaffolding needed for the team to continue building the full Food Bank platform while enforcing security, data integrity, and clean architecture.*
