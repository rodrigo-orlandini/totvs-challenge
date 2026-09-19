import { Product } from '../entities/product'
import { ProductPrice } from '../entities/value-objects/product-price'
import { SKU } from '../entities/value-objects/sku'

interface ProductRow {
  id: string
  sku: string
  name: string
  price: { toNumber(): number }
}

export class ProductMapper {
  static toDomain(row: ProductRow): Product {
    const skuOrError = SKU.create(row.sku)
    const priceOrError = ProductPrice.create(row.price.toNumber())

    if (skuOrError.isFailure()) throw new Error(`Invalid SKU in DB: ${row.sku}`)
    if (priceOrError.isFailure()) throw new Error(`Invalid price in DB: ${row.price.toNumber()}`)

    return Product.create(
      { sku: skuOrError.value, name: row.name, price: priceOrError.value },
      row.id,
    )
  }
}
