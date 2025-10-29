import 'reflect-metadata';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';

import type { AuditRecord } from '../db/ledger.js';
import { AuditLedgerService } from '../db/audit-ledger.service.js';
import { ManifestConfigService } from '../config/module.js';
import { OrchestratorModule } from '../orchestrator/orchestrator.module.js';
import { OrchestratorService } from '../orchestrator/orchestrator.service.js';

class InMemoryAuditLedgerService {
  public readonly records: AuditRecord[] = [];

  async record(record: AuditRecord): Promise<string> {
    this.records.push(record);
    return `hash_${this.records.length}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async onModuleDestroy(): Promise<void> {}
}

async function createTestingContext(options: { capabilityMode?: string } = {}) {
  if (options.capabilityMode) {
    process.env.CAPABILITY_MODE = options.capabilityMode;
  } else {
    delete process.env.CAPABILITY_MODE;
  }

  const auditStub = new InMemoryAuditLedgerService();

  const moduleRef = await Test.createTestingModule({
    imports: [OrchestratorModule]
  })
    .overrideProvider(AuditLedgerService)
    .useValue(auditStub)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    orchestrator: app.get(OrchestratorService),
    manifest: app.get(ManifestConfigService),
    auditStub
  };
}

const activeApps: NestFastifyApplication[] = [];

afterEach(async () => {
  delete process.env.CAPABILITY_MODE;
  while (activeApps.length > 0) {
    await activeApps.pop()?.close();
  }
});

describe('OrchestratorService', () => {
  it('respects caller narrowing on budgets', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const baseBudgets = await ctx.manifest.resolveBudgets('mpa.rumpole');
    const callerBudgets = { tokens_output_max: baseBudgets.tokens_output_max - 200 };

    const response = await ctx.orchestrator.execute({
      intent: 'Legal contract review',
      payload: { document: 'agreement' },
      callerBudgets
    });

    expect(response.budgets.granted.tokens_output_max).toBe(callerBudgets.tokens_output_max);
    expect(response.terminationCode).toBe('OK_PLACEHOLDER');
    expect(ctx.auditStub.records).toHaveLength(1);
    expect(ctx.auditStub.records[0].terminationCode).toBe('OK_PLACEHOLDER');
  });

  it('enforces hop bounds with refusal', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const manifest = await ctx.manifest.getManifest();

    const response = await ctx.orchestrator.execute({
      intent: 'Legal contract review',
      hopsTaken: manifest.routing.hop_bounds.max_hops,
      payload: {}
    });

    const expectedCode = manifest.routing.hop_bounds.on_exceed;

    expect(response.refusal?.code).toBe(expectedCode);
    expect(response.terminationCode).toBe(expectedCode);
    expect(ctx.auditStub.records).toHaveLength(1);
    expect(ctx.auditStub.records[0].terminationCode).toBe(expectedCode);
  });

  it('maps capability outages to DIS_INSUFFICIENT refusals', async () => {
    const ctx = await createTestingContext({ capabilityMode: 'disabled' });
    activeApps.push(ctx.app);

    const manifest = await ctx.manifest.getManifest();

    const response = await ctx.orchestrator.execute({
      intent: 'Legal contract review'
    });

    const expectedCode =
      manifest.config.refusal_aliases.DIS_INSUFFICIENT ?? 'REFUSAL(DIS_INSUFFICIENT)';

    expect(response.terminationCode).toBe(expectedCode);
    expect(response.refusal?.code).toBe(expectedCode);
    expect(ctx.auditStub.records[0].terminationCode).toBe(expectedCode);
  });
});

describe('Orchestrator HTTP ingress', () => {
  it('accepts POST requests and returns orchestrated output', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const response = await request(ctx.app.getHttpAdapter().getInstance().server)
      .post('/orchestrator')
      .send({
        intent: 'Legal contract review',
        payload: { document: 'nda' }
      })
      .expect(200);

    expect(response.body).toMatchObject({
      route: 'mpa.rumpole',
      terminationCode: 'OK_PLACEHOLDER'
    });
    expect(ctx.auditStub.records).toHaveLength(1);
  });
});
