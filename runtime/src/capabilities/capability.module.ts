import { Module } from '@nestjs/common';

import { CAPABILITY_ADAPTERS, CapabilityService } from './capability.service.js';
import { RumpoleCapabilityAdapter } from './rumpole.adapter.js';

@Module({
  providers: [
    CapabilityService,
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
