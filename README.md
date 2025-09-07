# Kuyari-LLM-Bot

Kuyari is a Discord LLM assistant with a web dashboard for per-guild control. Free basic chat + unlimited DJ; Premium/Pro unlock enhanced reasoning, image & music generation, and vision. Built with Next.js, discord.js, Postgres, Redis, Stripe, and Cloudflare R2.

## Features

- **Free Tier**: Basic chat functionality and unlimited DJ capabilities
- **Premium/Pro Tiers**: Enhanced reasoning, image generation, music generation, and vision capabilities
- **Web Dashboard**: Per-guild control and management
- **Multi-tenant Architecture**: Support for multiple Discord guilds with individual entitlements
- **Payment Integration**: Stripe integration for subscription management

## Tech Stack

- **Frontend**: Next.js with TypeScript
- **Backend**: Node.js with TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **Payments**: Stripe
- **Storage**: Cloudflare R2
- **Discord**: discord.js
- **Build System**: Turbo (monorepo)

## Project Structure

```
├── apps/
│   ├── bot/          # Discord bot application
│   ├── web/          # Next.js web dashboard
│   └── worker/       # Background worker processes
├── packages/
│   ├── db/           # Database layer and models
│   └── shared/       # Shared utilities and types
├── scripts/          # Utility scripts
└── sql/             # Database schema
```

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables (see `.env.example`)

3. Set up the database:
   ```bash
   # Run the DDL script to create tables
   psql -d your_database < sql/ddl.sql
   ```

4. Start development:
   ```bash
   pnpm dev
   ```

## Environment Variables

Copy `env.example` to `.env` and fill in your configuration:

```env
# Discord Bot
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/kuyari

# Redis
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
```

## License

This project is private and proprietary.
