import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaProductRepository } from './prisma-product-repository'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

const repo = new PrismaProductRepository(prisma)

beforeEach(async () => {
  await prisma.stockFlow.deleteMany()
  await prisma.product.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

async function insertProduct(data: { sku: string; name: string; price: number; stock: number }) {
  const product = await prisma.product.create({
    data: { sku: data.sku, name: data.name, price: data.price },
  })
  await prisma.stockFlow.create({
    data: { productId: product.id, quantity: data.stock },
  })
  return product
}

describe('PrismaProductRepository', () => {
  it('returns empty list when no products', async () => {
    const result = await repo.findAll({ page: 1, limit: 20 })
    expect(result.products).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('returns product with computed availableQuantity', async () => {
    await insertProduct({ sku: 'SKU-001', name: 'Capa iPhone 15', price: 49.9, stock: 30 })
    const result = await repo.findAll({ page: 1, limit: 20 })
    expect(result.products).toHaveLength(1)
    expect(result.products[0].sku).toBe('SKU-001')
    expect(result.products[0].availableQuantity).toBe(30)
    expect(result.products[0].price).toBe(49.9)
  })

  it('computes availableQuantity from multiple StockFlow entries', async () => {
    const product = await prisma.product.create({
      data: { sku: 'SKU-002', name: 'Capa Moto G84', price: 29.9 },
    })
    await prisma.stockFlow.createMany({
      data: [
        { productId: product.id, quantity: 100 },
        { productId: product.id, quantity: -15 },
      ],
    })
    const result = await repo.findAll({ page: 1, limit: 20 })
    expect(result.products[0].availableQuantity).toBe(85)
  })

  it('paginates correctly', async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        insertProduct({ sku: `SKU-${String(i).padStart(3, '0')}`, name: `Produto ${i}`, price: 10, stock: 5 }),
      ),
    )
    const page1 = await repo.findAll({ page: 1, limit: 10 })
    const page2 = await repo.findAll({ page: 2, limit: 10 })
    expect(page1.products).toHaveLength(10)
    expect(page2.products).toHaveLength(10)
    expect(page1.total).toBe(25)
    expect(page1.products[0].id).not.toBe(page2.products[0].id)
  })
})
