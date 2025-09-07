/**
 * Defines the per-plan capability caps. Adjust fields and types as your business logic
 * evolves. Each metric should be a number representing a monthly allowance for the guild.
 */
export interface Caps {
  dj_concurrency: number;
  tokens_month_in: number;
  tokens_month_out: number;
  image_gen: number;
  music_gen: number;
  vision_describe: number;
}