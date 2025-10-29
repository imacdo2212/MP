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
import {
  CAPABILITY_ADAPTERS,
  type CapabilityAdapter
} from '../capabilities/capability.service.js';

const SAMPLE_CONTRACT = `This Services Agreement ("Agreement") is made effective as of January 5, 2025 between
Acme Corporation ("Company") and Beta Analytics LLC ("Client"). The Company shall deliver data integration
services described in Exhibit A, and the Client must provide timely access to relevant systems. Either party may
terminate this Agreement upon thirty (30) days written notice in the event of material breach not cured within
fifteen (15) days. The parties agree to maintain confidentiality of all shared materials. Limitation of liability
restricts damages to direct losses and excludes consequential damages. Indemnification shall be provided by the
Company for third-party claims arising from its negligence.`;

class InMemoryAuditLedgerService {
  public readonly records: AuditRecord[] = [];
  private readonly throwOnRecord: boolean;

  constructor(options: { throwOnRecord?: boolean } = {}) {
    this.throwOnRecord = options.throwOnRecord ?? false;
  }

  async record(record: AuditRecord): Promise<string> {
    if (this.throwOnRecord) {
      throw new Error('ledger unavailable');
    }
    this.records.push(record);
    return `hash_${this.records.length}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async onModuleDestroy(): Promise<void> {}
}

interface TestingContextOptions {
  capabilityMode?: string;
  ledgerThrows?: boolean;
  adapters?: CapabilityAdapter[];
}

async function createTestingContext(options: TestingContextOptions = {}) {
  if (options.capabilityMode) {
    process.env.CAPABILITY_MODE = options.capabilityMode;
  } else {
    delete process.env.CAPABILITY_MODE;
  }

  const auditStub = new InMemoryAuditLedgerService({ throwOnRecord: options.ledgerThrows });

  let moduleBuilder = Test.createTestingModule({
    imports: [OrchestratorModule]
  }).overrideProvider(AuditLedgerService)
    .useValue(auditStub);

  if (options.adapters) {
    moduleBuilder = moduleBuilder.overrideProvider(CAPABILITY_ADAPTERS).useValue(options.adapters);
  }

  const moduleRef = await moduleBuilder.compile();

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

const SAMPLE_MEDICAL_PAYLOAD = {
  chiefComplaint: 'Acute chest pain radiating to left arm',
  symptoms: ['Chest pain', 'Shortness of breath'],
  vitals: { heartRate: 128, systolic: 182, diastolic: 96, spo2: 91 },
  medications: ['Aspirin 81mg daily'],
  history: ['Hypertension']
};

const SAMPLE_EDUCATION_PAYLOAD = {
  learner: 'Ava',
  age: 11,
  objectives: [
    { topic: 'Fractions equivalence', competency: 'emerging' },
    { topic: 'Multiplication facts', competency: 'developing' }
  ],
  observations: [{ note: 'Struggles to compare unlike denominators', evidenceType: 'assessment' }],
  targetOutcomes: ['Mastery of Year 6 fractions'],
  constraints: ['30 minute lesson block']
};

const SAMPLE_ENGINEERING_PAYLOAD = {
  objective: 'Ship event-driven notifications service',
  stack: ['TypeScript', 'Kafka', 'PostgreSQL'],
  constraints: ['Must deploy on existing Kubernetes cluster'],
  risks: ['Schema drift across services'],
  acceptanceCriteria: ['Handle 10k notifications/minute'],
  repoState: 'Monorepo with modular packages'
};

const SAMPLE_SCIENCE_PAYLOAD = {
  question: 'Does fertilizer X increase tomato yield?',
  hypothesis: 'Fertilizer X increases yield by at least 15%',
  method: 'Randomized controlled greenhouse trial',
  dataset: [
    { label: 'Control1', value: 3.1 },
    { label: 'Control2', value: 3.4 },
    { label: 'Treatment1', value: 3.9 },
    { label: 'Treatment2', value: 4.2 }
  ],
  constraints: ['limited budget']
};

const SAMPLE_TOOL_PAYLOAD = {
  tasks: ['Find current API quota for Maps', 'Summarize documentation updates'],
  preferredTools: ['tool.webSearch', 'tool.summarize'],
  environment: 'prod-support'
};

afterEach(async () => {
  delete process.env.CAPABILITY_MODE;
  while (activeApps.length > 0) {
    await activeApps.pop()?.close();
  }
});

describe('OrchestratorService', () => {
  it('Apex-T2: caller narrowing respected and overflow bounded', async () => {
    class OverflowAdapter implements CapabilityAdapter {
      supports(route: string): boolean {
        return route.toLowerCase() === 'mpa.rumpole';
      }

      async execute() {
        return {
          terminationCode: 'OK_OVERFLOW_SIMULATION',
          consumedBudgets: {
            tokens_output_max: 5_000,
            tokens_prompt_max: 4_800,
            time_ms: 120_000,
            mem_mb: 1_024,
            depth_max: 10,
            clarifying_questions_max: 5,
            tools_max: 3,
            tool_calls_max: 8,
            web_requests_max: 4,
            code_exec_ms_max: 30_000
          },
          output: { bounded: true },
          metadata: { adapter: 'overflow-sim', placeholder: false }
        } satisfies Awaited<ReturnType<CapabilityAdapter['execute']>>;
      }
    }

    const ctx = await createTestingContext({ adapters: [new OverflowAdapter()] });
    activeApps.push(ctx.app);

    const baseBudgets = await ctx.manifest.resolveBudgets('mpa.rumpole');
    const callerBudgets = { tokens_output_max: baseBudgets.tokens_output_max - 200 };

    const response = await ctx.orchestrator.execute({
      intent: 'Legal contract review',
      payload: { document: SAMPLE_CONTRACT },
      callerBudgets
    });

    expect(response.budgets.granted.tokens_output_max).toBe(callerBudgets.tokens_output_max);
    expect(response.budgets.consumed.tokens_output_max).toBe(callerBudgets.tokens_output_max);
    expect(response.budgets.consumed.time_ms).toBeLessThanOrEqual(response.budgets.granted.time_ms);
    expect(response.terminationCode).toBe('OK_OVERFLOW_SIMULATION');
    expect(response.metadata).toMatchObject({ adapter: 'overflow-sim', placeholder: false });
    expect(ctx.auditStub.records).toHaveLength(1);
    expect(ctx.auditStub.records[0].budgetsConsumed.tokens_output_max).toBe(
      callerBudgets.tokens_output_max
    );
  });

  it('Apex-T3: exceeding hop bounds emits configured refusal', async () => {
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

  it('continues orchestration when the ledger write fails', async () => {
    const ctx = await createTestingContext({ ledgerThrows: true });
    activeApps.push(ctx.app);

    const response = await ctx.orchestrator.execute({
      intent: 'Legal contract review',
      payload: { document: SAMPLE_CONTRACT }
    });

    expect(response.terminationCode).toBe('OK_RUMPOLE_ANALYZED');
    expect(response.metadata).toMatchObject({ ledgerWriteFailed: true, adapter: 'rumpole' });
    expect(ctx.auditStub.records).toHaveLength(0);
  });

  it('returns clarity refusal when caller budgets are invalid', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const response = await ctx.orchestrator.execute({
      intent: 'Legal contract review',
      payload: { document: SAMPLE_CONTRACT },
      callerBudgets: {
        tokens_output_max: -10 as unknown as number
      }
    });

    const manifest = await ctx.manifest.getManifest();
    const expectedCode =
      manifest.config.refusal_aliases.ENTROPY_CLARITY ?? 'REFUSAL(ENTROPY_CLARITY)';

    expect(response.terminationCode).toBe(expectedCode);
    expect(response.refusal?.code).toBe(expectedCode);
    expect(response.refusal?.reason).toContain('tokens_output_max');
    expect(ctx.auditStub.records).toHaveLength(1);
    expect(ctx.auditStub.records[0].terminationCode).toBe(expectedCode);
  });

  it('returns clarity refusal when hopsTaken is negative', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const response = await ctx.orchestrator.execute({
      intent: 'Legal contract review',
      hopsTaken: -1 as unknown as number
    });

    const manifest = await ctx.manifest.getManifest();
    const expectedCode =
      manifest.config.refusal_aliases.ENTROPY_CLARITY ?? 'REFUSAL(ENTROPY_CLARITY)';

    expect(response.terminationCode).toBe(expectedCode);
    expect(response.refusal?.code).toBe(expectedCode);
    expect(response.refusal?.reason).toContain('hopsTaken');
  });

  it('returns clarity refusal when requestId is malformed', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const response = await ctx.orchestrator.execute({
      intent: 'Legal contract review',
      requestId: 12345 as unknown as string
    });

    const manifest = await ctx.manifest.getManifest();
    const expectedCode =
      manifest.config.refusal_aliases.ENTROPY_CLARITY ?? 'REFUSAL(ENTROPY_CLARITY)';

    expect(response.terminationCode).toBe(expectedCode);
    expect(response.refusal?.code).toBe(expectedCode);
    expect(response.refusal?.reason).toContain('requestId');
    expect(ctx.auditStub.records).toHaveLength(1);
  });

  it('still returns refusal metadata when capability fails and ledger is offline', async () => {
    const ctx = await createTestingContext({ capabilityMode: 'disabled', ledgerThrows: true });
    activeApps.push(ctx.app);

    const manifest = await ctx.manifest.getManifest();
    const expectedCode =
      manifest.config.refusal_aliases.DIS_INSUFFICIENT ?? 'REFUSAL(DIS_INSUFFICIENT)';

    const response = await ctx.orchestrator.execute({
      intent: 'Legal contract review'
    });

    expect(response.terminationCode).toBe(expectedCode);
    expect(response.metadata).toMatchObject({ ledgerWriteFailed: true });
  });

  it('falls back to placeholder output when no adapter matches the route', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const response = await ctx.orchestrator.execute({
      intent: 'General inquiry outside routed domains',
      payload: { question: 'What is the schedule?' }
    });

    expect(response.route).toBe('mpa');
    expect(response.terminationCode).toBe('OK_PLACEHOLDER');
    expect(response.metadata).toMatchObject({ adapter: 'placeholder', placeholder: true });
  });

  it('Apex-T4: applies plane-specific budgets for routed intents', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const defaults = await ctx.manifest.resolveBudgets('mpa');
    const rumpoleBudgets = await ctx.manifest.resolveBudgets('mpa.rumpole');
    const toolBudgets = await ctx.manifest.resolveBudgets('mpt.search');

    expect(rumpoleBudgets.tokens_output_max).toBe(1800);
    expect(rumpoleBudgets.tokens_output_max).toBeGreaterThan(defaults.tokens_output_max);
    expect(toolBudgets.tool_calls_max).toBeLessThanOrEqual(defaults.tool_calls_max);
    expect(toolBudgets.web_requests_max).toBeLessThanOrEqual(defaults.web_requests_max);
  });

  it('honors placeholder mode even when an adapter exists', async () => {
    const ctx = await createTestingContext({ capabilityMode: 'placeholder' });
    activeApps.push(ctx.app);

    const response = await ctx.orchestrator.execute({
      intent: 'Legal contract review',
      payload: { document: SAMPLE_CONTRACT }
    });

    expect(response.terminationCode).toBe('OK_PLACEHOLDER');
    expect(response.metadata).toMatchObject({ adapter: 'placeholder', placeholder: true });
  });

  it('routes medical intents to Doctor Martin adapter', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const response = await ctx.orchestrator.execute({
      intent: 'Clinical triage chest pain',
      payload: SAMPLE_MEDICAL_PAYLOAD
    });

    expect(response.route).toBe('mpa.doctormartin');
    expect(response.terminationCode).toBe('OK_DOCTORMARTIN_TRIAGE');
    const triage = response.output?.triage as { disposition?: string } | undefined;
    expect(triage?.disposition).toBe('emergent');
    expect(response.metadata).toMatchObject({ adapter: 'doctor-martin', placeholder: false });
  });

  it('routes education intents to DfE adapter', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const response = await ctx.orchestrator.execute({
      intent: 'School lesson planning for fractions',
      payload: SAMPLE_EDUCATION_PAYLOAD
    });

    expect(response.route).toBe('mpa.dfe');
    expect(response.terminationCode).toBe('OK_DFE_LESSON_PLAN');
    const learningPlan = response.output?.learningPlan as { sequence?: unknown[] } | undefined;
    expect(learningPlan?.sequence).toHaveLength(4);
    expect(response.metadata).toMatchObject({ adapter: 'dfe', placeholder: false });
  });

  it('routes engineering intents to MPE adapter', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const response = await ctx.orchestrator.execute({
      intent: 'Engineering plan for notifications service',
      payload: SAMPLE_ENGINEERING_PAYLOAD
    });

    expect(response.route).toBe('mpe');
    expect(response.terminationCode).toBe('OK_MPE_WORKPLAN');
    const workstream = response.output?.workstream as { tasks?: unknown[] } | undefined;
    expect(workstream?.tasks?.length ?? 0).toBeGreaterThan(1);
    expect(response.metadata).toMatchObject({ adapter: 'engineering', placeholder: false });
  });

  it('routes science intents to MPS adapter', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const response = await ctx.orchestrator.execute({
      intent: 'Science experiment analysis for tomato yield',
      payload: SAMPLE_SCIENCE_PAYLOAD
    });

    expect(response.route).toBe('mps');
    expect(response.terminationCode).toBe('OK_MPS_ANALYSIS');
    const analysis = response.output?.analysis as { descriptiveStats?: { count?: number } } | undefined;
    expect(analysis?.descriptiveStats?.count).toBe(4);
    expect(response.metadata).toMatchObject({ adapter: 'science', placeholder: false });
  });

  it('routes tool intents to toolkit adapter', async () => {
    const ctx = await createTestingContext();
    activeApps.push(ctx.app);

    const response = await ctx.orchestrator.execute({
      intent: 'tool.lookup latest api limits',
      payload: SAMPLE_TOOL_PAYLOAD
    });

    expect(response.route).toBe('mptool');
    expect(response.terminationCode).toBe('OK_MPTOOL_PLAYBOOK');
    const recommended = response.output?.recommendedTools as unknown[] | undefined;
    expect(recommended?.length).toBe(2);
    expect(response.metadata).toMatchObject({ adapter: 'mptool', placeholder: false });
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
        payload: { document: SAMPLE_CONTRACT }
      })
      .expect(200);

    expect(response.body).toMatchObject({
      route: 'mpa.rumpole',
      terminationCode: 'OK_RUMPOLE_ANALYZED'
    });
    expect(response.body.output.summary).toBeDefined();
    expect(ctx.auditStub.records).toHaveLength(1);
  });
});
