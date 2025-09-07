-- SQL DDL for Kuyari bot database

-- Enable UUID generation if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Guilds table stores a record per Discord guild (server)
CREATE TABLE IF NOT EXISTS guilds (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_guild_id text UNIQUE NOT NULL,
    plan text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic','premium','pro')),
    plan_status text NOT NULL DEFAULT 'active' CHECK (plan_status IN ('active','past_due','canceled')),
    created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Subscriptions table stores Stripe subscription state per guild
CREATE TABLE IF NOT EXISTS subscriptions (
    stripe_subscription_id text PRIMARY KEY,
    guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    price_id text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    current_period_end timestamptz,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Guild entitlements table stores the plan and caps per guild
CREATE TABLE IF NOT EXISTS guild_entitlements (
    guild_id uuid PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
    plan text NOT NULL CHECK (plan IN ('basic','premium','pro')),
    caps jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT NOW()
);