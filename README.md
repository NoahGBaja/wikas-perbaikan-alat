# WIKAS Perbaikan Alat

Internal web app for reporting damaged office/school equipment, reviewing reports, tracking repair workflow, and managing users.

Built with Next.js App Router, Prisma 7, MariaDB, bcrypt password hashing, JWT auth cookies, and Sonner notifications.

## Main Features

- User login with NIP and password.
- User report submission with optional photo upload.
- User report status tracking and edit/delete while report is still `MENUNGGU`.
- Admin report approval, rejection, repair processing, completion notes, and completion photo.
- Admin monthly report statistics.
- Admin user management: create users, edit profile/role/NIP, reset password, soft-delete users.
- Account page for users/admins to change their own password.

## Requirements

- Node.js 24 or newer is recommended.
- MariaDB/MySQL database.
- npm.

## Environment Setup

Copy `.env.example` to `.env` and fill the values:

```env
DATABASE_URL="mysql://user:password@localhost:3306/wikas_perbaikan_alat"
AUTH_SECRET="replace-with-at-least-32-random-bytes"
APP_ORIGIN="http://localhost:3000"
DATABASE_CONNECTION_LIMIT="10"
STORAGE_DRIVER="local"
STORAGE_LOCAL_ROOT=".data/storage"
SEED_PASSWORD=""
```

Required variables:

- `DATABASE_URL`: MariaDB connection string.
- `AUTH_SECRET`: long random secret, at least 32 characters in production.
- `APP_ORIGIN`: allowed origin for same-origin mutation requests. Use your deployed HTTPS URL in production.
- `DATABASE_CONNECTION_LIMIT`: maximum MariaDB connections per app instance. Account for the number of replicas.
- `STORAGE_DRIVER`: `local` for one persistent server, or `s3` for multi-instance/serverless deployments.
- `SEED_PASSWORD`: only needed when running `scripts/seed.ts` manually.

## Install

```bash
npm install
npm run db:generate
```

## Database

Run migrations in development:

```bash
npm run db:migrate
```

Push schema without migration history, usually only for quick local experiments:

```bash
npm run db:push
```

Generate Prisma client after schema changes:

```bash
npm run db:generate
```

Production deploys should run Prisma migrations before starting the app. The current schema includes `RateLimitBucket`, used for login rate limiting.

```bash
npm run db:deploy
```

## Development

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Production

Build:

```bash
npm run build
```

Start:

```bash
npm run start
```

Before production release, run:

```bash
npm test
npm run build
```

## Available Scripts

- `npm run dev`: start the Next.js development server.
- `npm run build`: create a production build.
- `npm run start`: start the production server after building.
- `npm run lint`: run ESLint.
- `npm run typecheck`: run TypeScript type checking.
- `npm test`: run lint, typecheck, and lightweight Node tests.
- `npm run db:generate`: regenerate Prisma client.
- `npm run db:migrate`: run Prisma migrations in development.
- `npm run db:push`: push schema directly to the database.
- `npm run db:repair-local`: repair common local database drift without deleting data.
- `npm run change-password -- <nip> <password-baru>`: emergency password change script.

## Local Database Drift Repair

If your local database was created before the latest migrations and login fails with missing columns/tables such as `User.activeNip` or `RateLimitBucket`, run:

```bash
npm run db:repair-local
```

This adds the missing local columns/table used by the current app without resetting user/report data.

## Emergency Password Change

Prefer using the admin UI: `Dashboard Admin -> Kelola User -> Reset Password`.

If you are locked out or need manual recovery, use:

```bash
npm run change-password -- 198501010000000001 "PasswordBaru123!"
```

Or with environment variables:

```bash
CHANGE_PASSWORD_NIP=198501010000000001 CHANGE_PASSWORD_NEW="PasswordBaru123!" npm run change-password
```

The script:

- Finds the active user by NIP.
- Validates password strength.
- Hashes the password with bcrypt.
- Updates the user password in the database.
- Does not print the new password.

Password rule:

- Minimum 8 characters.
- Contains a letter.
- Contains a number.
- Contains a symbol.

## Seed Users

The seed script is available at `scripts/seed.ts`, but there is no npm script for it by default. It requires `SEED_PASSWORD`.

Example:

```bash
SEED_PASSWORD="Password123!" node --experimental-strip-types scripts/seed.ts
```

Use seed data carefully. It creates several admin/user accounts with the same seed password.

## Authentication Notes

- Auth uses an HTTP-only JWT cookie.
- Cookie sessions include a password-derived session tag, so changing a password invalidates old sessions.
- Users whose password is reset by an admin will need to log in again with the new password.
- Self password changes refresh the current auth cookie automatically.
- Independent forgot/reset password is disabled. Users should contact an admin.

## Uploads

Uploads are private and are served only after an authorization check. Local development stores them under:

```text
.data/storage
```

Image validation allows JPG, PNG, and WEBP, checks file size, and verifies image signatures.

For production with multiple instances, set `STORAGE_DRIVER=s3` and configure the `S3_*` variables from `.env.example`. Existing legacy files under `public/uploads` remain readable through the protected download endpoint, but direct public access is blocked.

## Admin Safety Rules

- Admins cannot delete their own active account.
- Admins cannot demote their own active account.
- The system prevents demoting the last active admin.
- Users are soft-deleted, including users with reports, so report history remains available and their NIP can safely be reused.

## Testing

Run:

```bash
npm test
```

Current tests cover:

- Password strength validation.
- Report input validation.

Add broader tests before public or high-risk deployment, especially for auth, admin user management, report workflow, and upload paths.

## Production Checklist

- Set `DATABASE_URL` to production MariaDB.
- Set a strong production `AUTH_SECRET`.
- Set `APP_ORIGIN` to the exact production HTTPS origin.
- Run all Prisma migrations.
- Configure S3-compatible private storage for multi-instance deployments, or persist and back up `.data/storage` for a single instance.
- Run `npm test`.
- Run `npm run build`.
- Confirm at least one active admin account exists.
- Confirm HTTPS is enabled in front of the app.
