import 'fastify';
import type { RequestContext } from '../server/request-context.js';

declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestContext;
  }
}
