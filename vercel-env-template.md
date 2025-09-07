# Vercel Environment Variables Setup

Copy these environment variables to your Vercel project settings:

## Required Environment Variables

### Discord Configuration
```
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=1414161267119095880
DISCORD_CLIENT_SECRET=your_discord_client_secret_here
```

### Database Configuration
```
DATABASE_URL=your_production_database_url_here
```

### Redis Configuration
```
REDIS_URL=your_production_redis_url_here
```

### Stripe Configuration
```
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Cloudflare R2 Configuration
```
R2_ACCOUNT_ID=your_cloudflare_account_id_here
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_BUCKET_NAME=your_r2_bucket_name_here
R2_PUBLIC_URL=https://your-bucket.your-account.r2.cloudflarestorage.com
```

### Application Configuration
```
NEXTAUTH_URL=https://kuyari-llm-bot.vercel.app
NEXTAUTH_SECRET=your_nextauth_secret_here
BASE_URL=https://kuyari-llm-bot.vercel.app
```

## How to Add These to Vercel

1. Go to https://vercel.com/fae-mclachlans-projects/kuyari-llm-bot
2. Click on "Settings" tab
3. Click on "Environment Variables" in the left sidebar
4. Add each variable above with its corresponding value
5. Make sure to set the environment to "Production" for all variables
6. Click "Save" after adding each variable
7. Redeploy your application

## Database Setup Options

### Option 1: Vercel Postgres (Recommended)
1. Go to Vercel Dashboard → Storage
2. Create a new Postgres database
3. Copy the connection string to DATABASE_URL

### Option 2: Supabase (Free tier available)
1. Go to https://supabase.com
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string to DATABASE_URL

## Redis Setup Options

### Option 1: Upstash Redis (Recommended)
1. Go to https://upstash.com
2. Create a new Redis database
3. Copy the connection string to REDIS_URL

### Option 2: Railway Redis
1. Go to https://railway.app
2. Create a new Redis service
3. Copy the connection string to REDIS_URL
