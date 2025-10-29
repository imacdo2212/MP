import { createApp } from './server/app.js';

async function main() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = '0.0.0.0';

  await app.listen({ port, host });
  app.log.info(`Ingress service listening on http://${host}:${port}`);
}

main().catch((error) => {
  console.error('Failed to start ingress service:', error);
  process.exitCode = 1;
});
