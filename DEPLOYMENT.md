# Kuyari Discord Bot - Vercel Deployment Guide

## 🚀 Quick Deployment Steps

### 1. Environment Variables Setup

1. **Go to your Vercel project**: https://vercel.com/fae-mclachlans-projects/kuyari-llm-bot
2. **Navigate to Settings → Environment Variables**
3. **Add all variables from `vercel-env-template.md`**
4. **Set environment to "Production" for all variables**

### 2. Database Setup (Choose one)

#### Option A: Vercel Postgres (Easiest)
1. Go to Vercel Dashboard → Storage
2. Click "Create Database" → "Postgres"
3. Name it "kuyari-db"
4. Copy the connection string to `DATABASE_URL`

#### Option B: Supabase (Free tier)
1. Go to https://supabase.com
2. Create new project
3. Go to Settings → Database
4. Copy connection string to `DATABASE_URL`

### 3. Redis Setup (Choose one)

#### Option A: Upstash Redis (Recommended)
1. Go to https://upstash.com
2. Create new Redis database
3. Copy connection string to `REDIS_URL`

#### Option B: Railway Redis
1. Go to https://railway.app
2. Create new Redis service
3. Copy connection string to `REDIS_URL`

### 4. Stripe Webhook Setup

1. **Go to Stripe Dashboard → Webhooks**
2. **Click "Add endpoint"**
3. **Set URL**: `https://kuyari-llm-bot.vercel.app/api/stripe/webhook`
4. **Select events**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. **Copy webhook secret to `STRIPE_WEBHOOK_SECRET`**

### 5. Deploy

1. **Push changes to GitHub**:
   ```bash
   git add .
   git commit -m "Add Vercel configuration"
   git push origin main
   ```

2. **Vercel will auto-deploy** from your GitHub repository

3. **Check deployment status** in Vercel dashboard

### 6. Test Your Deployment

1. **Visit your app**: https://kuyari-llm-bot.vercel.app
2. **Test webhook endpoint**: https://kuyari-llm-bot.vercel.app/api/stripe/webhook
3. **Check Vercel logs** for any errors

## 🔧 Troubleshooting

### Common Issues

1. **Build fails**: Check that all environment variables are set
2. **Database connection fails**: Verify DATABASE_URL is correct
3. **Redis connection fails**: Verify REDIS_URL is correct
4. **Stripe webhooks fail**: Check webhook secret and endpoint URL

### Checking Logs

1. Go to Vercel Dashboard → Functions
2. Click on any function to see logs
3. Check for error messages

## 📝 Next Steps After Deployment

1. **Set up Discord bot hosting** (Railway, Heroku, or DigitalOcean)
2. **Test payment flow** with Stripe test mode
3. **Configure domain** if needed
4. **Set up monitoring** and alerts

## 🆘 Need Help?

- Check Vercel documentation: https://vercel.com/docs
- Check Stripe webhook testing: https://stripe.com/docs/webhooks/test
- Check Discord bot documentation: https://discord.js.org/#/docs
