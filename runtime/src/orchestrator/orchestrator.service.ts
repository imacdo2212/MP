import crypto from 'crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import type { BudgetDefaults, BudgetOverrides, Manifest } from '../config/manifest.js';
import { ManifestConfigService } from '../config/module.js';
import {
  CapabilityService,
  CapabilityUnavailableError
} from '../capabilities/capability.service.js';
import { AuditLedgerService } from '../db/audit-ledger.service.js';
import type { BudgetConsumption } from '../db/ledger.js';

export interface OrchestratorRequest {
  intent: string;
  payload?: unknown;
  callerBudgets?: BudgetOverrides;
  hopsTaken?: number;
  requestId?: string;
}

export interface OrchestratorResponse {
  execId: string;
  route: string;
  hopCount: number;
  terminationCode: string;
  refusal?: { code: string; reason: string };
  output?: Record<string, unknown>;
  budgets: { granted: BudgetDefaults; consumed: BudgetConsumption };
  metadata?: Record<string, unknown>;
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    @Inject(ManifestConfigService) private readonly manifest: ManifestConfigService,
    @Inject(CapabilityService) private readonly capabilities: CapabilityService,
    @Inject(AuditLedgerService) private readonly ledger: AuditLedgerService
  ) {}

  async execute(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const manifest = await this.manifest.getManifest();
    const intent = request.intent?.trim();
    const payload = request.payload ?? {};

    if (!intent) {
      const defaultBudgets = await this.manifest.resolveBudgets('mpa');
      return this.buildRefusalResponse({
        request,
        hopCount: (request.hopsTaken ?? 0) + 1,
        terminationCode: manifest.config.refusal_aliases.ENTROPY_CLARITY ?? 'REFUSAL(ENTROPY_CLARITY)',
        reason: 'Clarity gate rejected empty intent.',
        budgets: defaultBudgets
      });
    }

    const route = await this.manifest.getIntentRoute(intent);
    const baseBudgets = await this.manifest.resolveBudgets(route);
    const grantedBudgets = this.applyCallerBudgets(
      manifest.config.budget_policy,
      baseBudgets,
      request.callerBudgets
    );
    const hopCount = (request.hopsTaken ?? 0) + 1;

    if (hopCount > manifest.routing.hop_bounds.max_hops) {
      return this.buildRefusalResponse({
        request,
        hopCount,
        route,
        budgets: grantedBudgets,
        terminationCode: manifest.routing.hop_bounds.on_exceed,
        reason: 'Hop bound exceeded prior to execution.'
      });
    }

    const execId = this.createExecId(intent, payload, route, request.requestId);

    try {
      const capabilityResult = await this.capabilities.execute({
        intent,
        payload,
        route,
        budgets: grantedBudgets
      });

      const consumedBudgets = this.clampConsumption(capabilityResult.consumedBudgets, grantedBudgets);
      let responseMetadata = capabilityResult.metadata
        ? { ...capabilityResult.metadata }
        : undefined;

      try {
        await this.ledger.record({
          execId,
          intent,
          route,
          hopCount,
          budgetsGranted: grantedBudgets,
          budgetsConsumed: consumedBudgets,
          terminationCode: capabilityResult.terminationCode,
          metadata: {
            ...capabilityResult.metadata,
            requestId: request.requestId ?? null
          }
        });
      } catch (error) {
        this.logger.warn(
          `Failed to persist audit frame for ${execId} (${intent} → ${route}): ${String(error)}`
        );
        if (responseMetadata) {
          responseMetadata.ledgerWriteFailed = true;
        } else {
          responseMetadata = { ledgerWriteFailed: true };
        }
      }

      return {
        execId,
        route,
        hopCount,
        terminationCode: capabilityResult.terminationCode,
        output: capabilityResult.output,
        budgets: {
          granted: grantedBudgets,
          consumed: consumedBudgets
        },
        metadata: responseMetadata
      };
    } catch (error) {
      const refusalCode = await this.resolveRefusalForError(error);
      this.logger.warn(`Execution failed for ${intent} → ${route}: ${String(error)}`);
      let refusalMetadata: Record<string, unknown> | undefined;

      try {
        await this.ledger.record({
          execId,
          intent,
          route,
          hopCount,
          budgetsGranted: grantedBudgets,
          budgetsConsumed: {},
          terminationCode: refusalCode,
          metadata: {
            error: error instanceof Error ? error.message : String(error),
            requestId: request.requestId ?? null
          }
        });
      } catch (ledgerError) {
        this.logger.warn(
          `Failed to persist refusal audit frame for ${execId} (${intent} → ${route}): ${String(ledgerError)}`
        );
        refusalMetadata = { ledgerWriteFailed: true };
      }

      return {
        execId,
        route,
        hopCount,
        terminationCode: refusalCode,
        refusal: {
          code: refusalCode,
          reason: error instanceof Error ? error.message : 'Unknown capability failure.'
        },
        budgets: {
          granted: grantedBudgets,
          consumed: {}
        },
        metadata: refusalMetadata
      };
    }
  }

  private async buildRefusalResponse({
    request,
    hopCount,
    route = 'mpa',
    budgets,
    terminationCode,
    reason
  }: {
    request: OrchestratorRequest;
    hopCount: number;
    route?: string;
    budgets: BudgetDefaults;
    terminationCode: string;
    reason: string;
  }): Promise<OrchestratorResponse> {
    const execId = this.createExecId(request.intent ?? '', request.payload ?? {}, route, request.requestId);

    let ledgerWriteFailed = false;
    try {
      await this.ledger.record({
        execId,
        intent: request.intent ?? '',
        route,
        hopCount,
        budgetsGranted: budgets,
        budgetsConsumed: {},
        terminationCode,
        metadata: {
          reason,
          requestId: request.requestId ?? null
        }
      });
    } catch (error) {
      ledgerWriteFailed = true;
      this.logger.warn(`Failed to persist refusal audit frame: ${String(error)}`);
    }

    const response: OrchestratorResponse = {
      execId,
      route,
      hopCount,
      terminationCode,
      refusal: {
        code: terminationCode,
        reason
      },
      budgets: {
        granted: budgets,
        consumed: {}
      }
    };

    if (ledgerWriteFailed) {
      response.metadata = { ledgerWriteFailed: true };
    }

    return response;
  }

  private applyCallerBudgets(
    policy: Manifest['config']['budget_policy'],
    base: BudgetDefaults,
    overrides: BudgetOverrides | undefined
  ): BudgetDefaults {
    if (!overrides) {
      return base;
    }
    const merged: BudgetDefaults = { ...base };

    for (const key of Object.keys(overrides) as (keyof BudgetDefaults)[]) {
      const incoming = overrides[key];
      if (typeof incoming === 'undefined') {
        continue;
      }

      const current = merged[key];
      if (typeof current === 'number' && typeof incoming === 'number') {
        Reflect.set(
          merged,
          key,
          policy.caller_narrows ? Math.min(current, incoming) : incoming
        );
      } else {
        Reflect.set(merged, key, incoming as BudgetDefaults[typeof key]);
      }
    }

    return merged;
  }

  private clampConsumption(
    consumed: BudgetConsumption,
    granted: BudgetDefaults
  ): BudgetConsumption {
    const clamped: BudgetConsumption = {};

    for (const key of Object.keys(consumed) as (keyof BudgetDefaults)[]) {
      const value = consumed[key];
      if (typeof value === 'undefined') {
        continue;
      }

      const grant = granted[key];
      if (typeof value === 'number' && typeof grant === 'number') {
        Reflect.set(clamped, key, Math.min(value, grant));
      } else {
        Reflect.set(clamped, key, value as BudgetDefaults[typeof key]);
      }
    }

    return clamped;
  }

  private async resolveRefusalForError(error: unknown): Promise<string> {
    const manifest = await this.manifest.getManifest();
    const aliases = manifest.config.refusal_aliases;

    if (error instanceof CapabilityUnavailableError) {
      return aliases.DIS_INSUFFICIENT ?? 'REFUSAL(DIS_INSUFFICIENT)';
    }

    return aliases.FRAGILITY ?? 'REFUSAL(FRAGILITY)';
  }

  private createExecId(intent: string, payload: unknown, route: string, requestId?: string): string {
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(this.sortValue(payload)))
      .digest('hex');
    const base = requestId ?? `${intent}::${route}::${payloadHash}`;
    const digest = crypto.createHash('sha256').update(base).digest('hex').slice(0, 16);
    return `exec_${digest}`;
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }

    if (value && typeof value === 'object' && value.constructor === Object) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = this.sortValue((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }

    return value;
  }
}
