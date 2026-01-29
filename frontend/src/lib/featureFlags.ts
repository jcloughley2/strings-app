/**
 * Feature Flags
 * 
 * Centralized configuration for enabling/disabling features in the app.
 * Set flags to `true` to enable, `false` to disable.
 * 
 * Usage:
 *   import { FEATURES } from '@/lib/featureFlags';
 *   if (FEATURES.REGISTRY) { ... }
 */

export const FEATURES = {
  /**
   * Registry Feature
   * - Publishing tab in string create/edit drawer
   * - Registry button on homepage
   * - Registry page (/registry)
   * - Style Guide generator
   */
  REGISTRY: false,

  /**
   * AI Features
   * - OpenAI integration in settings
   * - Image-to-text extraction
   * - Style Guide generator (also requires REGISTRY)
   */
  AI_FEATURES: true,
} as const;

// Type for feature flag keys
export type FeatureFlag = keyof typeof FEATURES;
