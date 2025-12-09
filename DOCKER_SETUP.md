# Docker Database Setup

This setup allows you to test Prisma schema changes without affecting your existing production database.

## Quick Start

1. **Start the Docker database:**
   ```bash
   docker-compose up -d
   ```

2. **Create a `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
   
   Or manually create `.env` with:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/caser_deep_agent_dev?schema=public"
   ```

3. **Push your schema to the Docker database:**
   ```bash
   npx prisma db push
   ```

4. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

## Docker Commands

- **Start database:** `docker-compose up -d`
- **Stop database:** `docker-compose down`
- **Stop and remove data:** `docker-compose down -v`
- **View logs:** `docker-compose logs -f postgres`
- **Check status:** `docker-compose ps`

## Database Details

- **Host:** localhost
- **Port:** 5433 (to avoid conflicts with existing PostgreSQL on 5432)
- **Database:** caser_deep_agent_dev
- **Username:** postgres
- **Password:** postgres

## Switching Back to Production

When you're done testing, simply update your `.env` file with your production `DATABASE_URL` and restart your application.

