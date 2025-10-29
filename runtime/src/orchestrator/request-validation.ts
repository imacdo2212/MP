import { z } from 'zod';

import { budgetOverridesSchema } from '../config/manifest.js';

export const orchestratorRequestSchema = z
  .object({
    callerBudgets: budgetOverridesSchema.optional(),
    hopsTaken: z
      .number({ invalid_type_error: 'hopsTaken must be an integer.' })
      .int('hopsTaken must be an integer.')
      .min(0, 'hopsTaken must be non-negative.')
      .optional(),
    requestId: z
      .string({ invalid_type_error: 'requestId must be a string.' })
      .trim()
      .min(1, 'requestId must not be empty when provided.')
      .max(120, 'requestId must be at most 120 characters.')
      .optional(),
    payload: z.unknown().optional(),
    intent: z.string().optional()
  })
  .passthrough();

export type OrchestratorRequestEnvelope = z.infer<typeof orchestratorRequestSchema>;
