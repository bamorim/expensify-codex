# Expensify - Core Onboarding Platform

A type-safe expense management foundation built with the T3 stack. The current milestone focuses on
user authentication, organization onboarding, and invitation workflows.

## Key Capabilities

- 🔐 Magic-link email authentication powered by NextAuth and Nodemailer
- 🏢 Organization creation with automatic admin membership
- 👥 Role-based invitations and acceptance flows for members and admins
- 🗂️ Organization-scoped expense categories with admin-managed CRUD
- 🛡️ Organization-scoped authorization middleware that enforces data isolation
- ⚙️ Fully typed API layer using Prisma and tRPC

## Prerequisites

- [pnpm](https://pnpm.io/) 9+
- [Docker](https://www.docker.com/) (for PostgreSQL and the Mailpit email capture service)
- Node.js 18+

## Environment Variables

Create a local `.env` file based on `.env.example` and provide the following values:

| Variable      | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| `DATABASE_URL`| PostgreSQL connection string                                   |
| `MAIL_SERVER` | SMTP server connection string (defaults to Mailpit container)  |
| `MAIL_FROM`   | Email address used as the sender for magic-link emails         |
| `AUTH_SECRET` | Secret used by NextAuth to encrypt session tokens              |

> The supplied `compose.yml` starts a Mailpit instance on ports `8025` (web UI) and `1025` (SMTP),
> which works with the default values in `src/env.js`.

## Getting Started

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Start infrastructure**
   ```bash
   docker compose up -d
   ```

3. **Apply database migrations**
   ```bash
   pnpm prisma migrate dev
   ```

4. **Run the dev server**
   ```bash
   pnpm dev
   ```

   Visit `http://localhost:3000` and sign in with any email address. Use the Mailpit UI at
   `http://localhost:8025` to retrieve the magic link.

## Testing

Use a separate test database defined in `.env.test`:

```bash
pnpm test:reset   # Reset and migrate the test database
pnpm test         # Run Vitest integration suite
```

## Project Structure Highlights

- `prisma/` – Prisma schema and migrations for organizations, memberships, invitations, and categories
- `src/server/api/routers/organization.ts` – tRPC handlers for onboarding flows
- `src/server/api/routers/category.ts` – Expense category CRUD procedures with role enforcement
- `src/app/_components/organization-dashboard.tsx` – Client UI for organization management
- `docs/tasks/` – Task tracking and product documentation

This README will evolve as new expense management capabilities (policies, submissions, reviews) are
implemented in upcoming tasks.
