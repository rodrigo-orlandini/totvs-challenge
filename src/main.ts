import 'reflect-metadata'
import { registerCatalogModule } from '@modules/catalog/container'
import { buildApp } from '@infra/http/server'

async function bootstrap(): Promise<void> {
  registerCatalogModule()
  const app = await buildApp()
  const port = Number(process.env.PORT ?? 3000)
  await app.listen({ port, host: '0.0.0.0' })
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
