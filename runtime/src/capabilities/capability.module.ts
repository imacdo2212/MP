import { Module } from '@nestjs/common';

import { CAPABILITY_ADAPTERS, CapabilityService } from './capability.service.js';
import { DoctorMartinCapabilityAdapter } from './doctor-martin.adapter.js';
import { DfeCapabilityAdapter } from './dfe.adapter.js';
import { EngineeringCapabilityAdapter } from './engineering.adapter.js';
import { RumpoleCapabilityAdapter } from './rumpole.adapter.js';
import { ScienceCapabilityAdapter } from './science.adapter.js';
import { ToolkitCapabilityAdapter } from './toolkit.adapter.js';
import { RumpoleCapabilityAdapter } from './rumpole.adapter.js';

@Module({
  providers: [
    CapabilityService,
    DoctorMartinCapabilityAdapter,
    DfeCapabilityAdapter,
    EngineeringCapabilityAdapter,
    RumpoleCapabilityAdapter,
    ScienceCapabilityAdapter,
    ToolkitCapabilityAdapter,
    {
      provide: CAPABILITY_ADAPTERS,
      useFactory: (
        rumpole: RumpoleCapabilityAdapter,
        doctorMartin: DoctorMartinCapabilityAdapter,
        dfe: DfeCapabilityAdapter,
        engineering: EngineeringCapabilityAdapter,
        science: ScienceCapabilityAdapter,
        toolkit: ToolkitCapabilityAdapter
      ) => [rumpole, doctorMartin, dfe, engineering, science, toolkit],
      inject: [
        RumpoleCapabilityAdapter,
        DoctorMartinCapabilityAdapter,
        DfeCapabilityAdapter,
        EngineeringCapabilityAdapter,
        ScienceCapabilityAdapter,
        ToolkitCapabilityAdapter
      ]
    }
  ],
    RumpoleCapabilityAdapter,
    {
      provide: CAPABILITY_ADAPTERS,
      useFactory: (rumpole: RumpoleCapabilityAdapter) => [rumpole],
      inject: [RumpoleCapabilityAdapter]
    }
  ],
import { CapabilityService } from './capability.service.js';

@Module({
  providers: [CapabilityService],
  exports: [CapabilityService]
})
export class CapabilityModule {}
