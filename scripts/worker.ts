// scripts/worker.ts
import 'dotenv/config';
import Redis from 'ioredis';
import { getEntitlement } from '@kuyari/shared';

const redis = new Redis(process.env.REDIS_URL!);
const APP_ID = process.env.DISCORD_CLIENT_ID!; // Application ID

async function processJob(job: any) {
  try {
    console.log(`Processing job: ${job.command} for user ${job.userId}`);
    
    let resultText = '';
    
    switch (job.command) {
      case 'plan': {
        const action = job.options.find((opt: any) => opt.name === 'action')?.value || 'view';
        
        if (action === 'view') {
          if (!job.guildId) {
            resultText = '❌ This command must be used in a server.';
            break;
          }
          
          const ent = await getEntitlement(job.guildId);
          resultText = `**Plan:** ${ent.plan}\n**DJ Slots:** ${ent.caps.dj_concurrency}\n**Monthly Tokens:** ${ent.caps.tokens_month_in.toLocaleString()}`;
        } else if (action === 'subscribe') {
          resultText = '🔗 [Upgrade your server plan](https://kuyari-llm-bot.vercel.app) to unlock premium features!';
        } else if (action === 'cancel') {
          resultText = '📧 Contact support to cancel your subscription.';
        }
        break;
      }
      
      case 'dj': {
        const action = job.options.find((opt: any) => opt.name === 'action')?.value;
        const query = job.options.find((opt: any) => opt.name === 'query')?.value;
        
        if (!job.guildId) {
          resultText = '❌ DJ commands must be used in a voice channel.';
          break;
        }
        
        const ent = await getEntitlement(job.guildId);
        if (ent.caps.dj_concurrency <= 0) {
          resultText = '❌ DJ functionality requires a premium plan. [Upgrade here](https://kuyari-llm-bot.vercel.app)';
          break;
        }
        
        switch (action) {
          case 'play':
            resultText = query ? `🎵 Playing: ${query}` : '❌ Please provide a song name or URL.';
            break;
          case 'stop':
            resultText = '⏹️ Music stopped.';
            break;
          case 'skip':
            resultText = '⏭️ Skipped to next song.';
            break;
          case 'queue':
            resultText = '📋 Current queue: [Feature coming soon]';
            break;
          default:
            resultText = '❌ Invalid DJ action.';
        }
        break;
      }
      
      default:
        resultText = `Command **${job.command}** processed for <@${job.userId}> ✅`;
    }

    // Follow-up message
    await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${job.token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: resultText,
        flags: 1 << 6, // ephemeral follow-up too
      }),
    });
    
    console.log(`Successfully processed ${job.command} for user ${job.userId}`);
  } catch (err) {
    console.error(`Error processing job ${job.command}:`, err);
    
    await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${job.token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: 'Sorry, something went wrong. Please try again.',
        flags: 1 << 6,
      }),
    });
  }
}

async function loop() {
  console.log('Worker started, waiting for jobs...');
  
  while (true) {
    try {
      // Blocks until a job arrives
      const result = await redis.brpop('kuyari:jobs', 0);
      if (result) {
        const [, raw] = result;
        const job = JSON.parse(raw);
        await processJob(job);
      }
    } catch (error) {
      console.error('Error in worker loop:', error);
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down worker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down worker...');
  process.exit(0);
});

// Start the worker
loop().catch((e) => {
  console.error('Worker crashed:', e);
  process.exit(1);
});

