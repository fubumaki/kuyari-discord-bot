# Discord Interactions Setup Guide

## 🎯 Overview

Your Discord bot now supports slash commands via Discord Interactions (HTTPS) instead of WebSocket connections. This is perfect for Vercel's serverless architecture.

## 🔧 Required Environment Variables

Add this to your Vercel environment variables:

```env
DISCORD_PUBLIC_KEY=your_discord_public_key_here
```

**To get your Discord Public Key:**
1. Go to Discord Developer Portal → Your Application
2. Go to "General Information"
3. Copy the "Public Key" (not the Application ID)

## 🚀 Setup Steps

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Register Slash Commands
```bash
pnpm run register-commands
```

This will register these commands:
- `/ping` - Test bot connection
- `/plan` - View/manage subscription plans
- `/dj` - Music/DJ commands

### 3. Set Discord Interactions Endpoint
1. Go to Discord Developer Portal → Your Application
2. Go to "General Information"
3. Set "Interactions Endpoint URL" to:
   ```
   https://kuyari-llm-bot.vercel.app/api/discord/interactions
   ```
4. Click "Save Changes"
5. Discord will send a PING - your endpoint should respond with PONG

### 4. Start the Worker (Optional)
For processing heavy commands asynchronously:

```bash
pnpm run worker
```

Or deploy the worker to a service like Railway, Fly, or Render.

## 🎮 Available Commands

### `/ping`
- **Description**: Test the bot connection
- **Usage**: `/ping`
- **Response**: Pong! (ephemeral)

### `/plan`
- **Description**: View or manage subscription plans
- **Options**:
  - `action` (optional): view, subscribe, cancel
- **Usage**: 
  - `/plan` - View current plan
  - `/plan action:subscribe` - Get upgrade link
  - `/plan action:cancel` - Get cancellation info

### `/dj`
- **Description**: Music/DJ commands
- **Options**:
  - `action` (required): play, stop, skip, queue
  - `query` (optional): Song name or URL
- **Usage**:
  - `/dj action:play query:Never Gonna Give You Up`
  - `/dj action:stop`
  - `/dj action:skip`
  - `/dj action:queue`

## 🔒 Security Features

- **Ed25519 Signature Verification**: All requests are cryptographically verified
- **Idempotency Protection**: Prevents duplicate processing on Discord retries
- **Ephemeral Responses**: Commands are private to the user
- **Rate Limiting**: Built-in protection against abuse

## 🏗️ Architecture

```
Discord → Interactions Endpoint → Redis Queue → Worker → Discord Follow-up
```

1. **Discord** sends interaction to your Vercel endpoint
2. **Endpoint** verifies signature and queues job in Redis
3. **Worker** processes job and sends follow-up message
4. **User** sees response (ephemeral)

## 🐛 Troubleshooting

### Commands Not Appearing
1. Check if commands are registered: `pnpm run register-commands`
2. Wait 1-2 minutes for Discord to update
3. Try refreshing Discord (Ctrl+R)

### Interactions Endpoint Not Working
1. Check Vercel logs for errors
2. Verify `DISCORD_PUBLIC_KEY` is set correctly
3. Test with `/ping` command

### Worker Not Processing Jobs
1. Check Redis connection
2. Verify `REDIS_URL` is set correctly
3. Check worker logs for errors

## 📝 Next Steps

1. **Test all commands** in your Discord server
2. **Deploy worker** to a hosting service for production
3. **Add more commands** as needed
4. **Integrate with Stripe** for subscription management

## 🔗 Useful Links

- [Discord Interactions Documentation](https://discord.com/developers/docs/interactions/overview)
- [Discord Slash Commands Guide](https://discord.com/developers/docs/interactions/application-commands)
- [Vercel Functions Documentation](https://vercel.com/docs/functions)

