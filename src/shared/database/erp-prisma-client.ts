import { PrismaClient } from '@prisma/client'

export const erpPrisma = new PrismaClient({
  datasources: { db: { url: process.env.ERP_DATABASE_URL } },
})
