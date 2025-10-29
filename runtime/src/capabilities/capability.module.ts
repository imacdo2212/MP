import { Module } from '@nestjs/common';

import { CapabilityService } from './capability.service.js';

@Module({
  providers: [CapabilityService],
  exports: [CapabilityService]
})
export class CapabilityModule {}
