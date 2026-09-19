import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const prisma = new PrismaClient()

const BRANDS = {
  Apple: ['iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 13'],
  Samsung: ['Galaxy S24 Ultra', 'Galaxy S24', 'Galaxy S23', 'Galaxy A54', 'Galaxy A34', 'Galaxy M54'],
  Motorola: ['Moto G84', 'Moto G54', 'Edge 40', 'Moto G73', 'Moto G53'],
  Xiaomi: ['Redmi Note 13 Pro', 'Redmi Note 13', 'Poco X5 Pro', 'Poco X5', '13T Pro'],
  'Realme': ['GT 5', 'GT Neo 5', '11 Pro', 'Narzo 60', 'C55'],
  'OnePlus': ['12', '11', 'Nord CE 3', 'Nord 3'],
  Sony: ['Xperia 5 V', 'Xperia 1 V', 'Xperia 10 V'],
  Asus: ['ROG Phone 7', 'Zenfone 10'],
  Nokia: ['G42', 'C32', 'X30'],
  LG: ['Velvet 5G', 'Wing 5G'],
}

const MATERIALS = ['Silicone', 'TPU', 'Hard Plastic', 'Leather', 'Carbon Fiber']
const COLORS = ['Black', 'Blue', 'Red', 'Green', 'White', 'Clear', 'Purple', 'Navy']

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

function buildSKU(brand, model, material, color) {
  return `CASE-${slugify(brand)}-${slugify(model)}-${slugify(material)}-${slugify(color)}`.toUpperCase().slice(0, 64)
}

function randomPrice() {
  const prices = [19.9, 24.9, 29.9, 34.9, 39.9, 49.9, 59.9, 69.9, 89.9, 99.9, 129.9, 149.9]
  return prices[Math.floor(Math.random() * prices.length)]
}

async function main() {
  console.log('Seeding database...')

  await prisma.stockFlow.deleteMany()
  await prisma.product.deleteMany()

  const products = []
  const seen = new Set()

  for (const [brand, models] of Object.entries(BRANDS)) {
    for (const model of models) {
      const material = MATERIALS[Math.floor(Math.random() * MATERIALS.length)]
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const sku = buildSKU(brand, model, material, color)

      if (seen.has(sku)) continue
      seen.add(sku)

      products.push({
        id: randomUUID(),
        sku,
        name: `Capa ${material} ${color} — ${brand} ${model}`,
        price: randomPrice(),
      })

      if (products.length >= 100) break
    }
    if (products.length >= 100) break
  }

  // Fill up to 100 if needed with extra color variants
  let extra = 0
  outer: for (const [brand, models] of Object.entries(BRANDS)) {
    for (const model of models) {
      for (const material of MATERIALS) {
        for (const color of COLORS) {
          if (products.length >= 100) break outer
          const sku = buildSKU(brand, model, material, color)
          if (seen.has(sku)) continue
          seen.add(sku)
          products.push({
            id: randomUUID(),
            sku,
            name: `Capa ${material} ${color} — ${brand} ${model}`,
            price: randomPrice(),
          })
          extra++
        }
      }
    }
  }

  await prisma.product.createMany({ data: products })

  const stockFlows = products.map((p) => ({
    id: randomUUID(),
    productId: p.id,
    quantity: Math.floor(Math.random() * 191) + 10,
    movedAt: new Date(),
  }))

  await prisma.stockFlow.createMany({ data: stockFlows })

  console.log(`Seeded ${products.length} products and ${stockFlows.length} stock flow entries.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
