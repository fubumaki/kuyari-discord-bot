/**
 * Defines the mapping from plan names and capabilities to specific providers and
 * model identifiers. Extend or modify this registry as new models or providers
 * become available. Use this registry in your bot command handlers to select
 * the correct backend based on the guild's plan.
 */
export type PlanName = 'basic' | 'premium' | 'pro';
export type Capability = 'text_basic' | 'reasoning' | 'vision_describe' | 'image_generate' | 'music_generate';

export interface ModelEntry {
  provider: string;
  model: string;
}

const registry: Record<PlanName, Partial<Record<Capability, ModelEntry>>> = {
  basic: {
    text_basic: { provider: 'open', model: 'small-8b-instruct-q4' },
  },
  premium: {
    text_basic: { provider: 'open', model: 'small-8b-instruct-q4' },
    reasoning: { provider: 'vendorA', model: 'mid-reasoning' },
    vision_describe: { provider: 'vendorA', model: 'vision-mid' },
    image_generate: { provider: 'vendorB', model: 'imagen' },
    music_generate: { provider: 'vendorC', model: 'music-gen' },
  },
  pro: {
    text_basic: { provider: 'open', model: 'small-8b-instruct-q4' },
    reasoning: { provider: 'vendorA', model: 'pro-reasoning' },
    vision_describe: { provider: 'vendorA', model: 'vision-pro' },
    image_generate: { provider: 'vendorB', model: 'imagen-pro' },
    music_generate: { provider: 'vendorC', model: 'music-gen-pro' },
  },
};

/**
 * Retrieves the provider and model for a given plan and capability. Throws
 * an error if the capability is not available for the specified plan.
 */
export function routeModel(plan: PlanName, capability: Capability): ModelEntry {
  const entry = registry[plan]?.[capability];
  if (!entry) throw new Error('Capability not available on your plan.');
  return entry;
}