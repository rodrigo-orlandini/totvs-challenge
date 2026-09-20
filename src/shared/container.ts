import { container } from 'tsyringe'
import { prisma } from './database/prisma-client'
import { erpPrisma } from './database/erp-prisma-client'

export function registerSharedInfra(): void {
  container.register('PrismaClient', { useValue: prisma })
  container.register('ErpPrismaClient', { useValue: erpPrisma })
}
