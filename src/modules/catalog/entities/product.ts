import { randomUUID } from 'node:crypto'
import type { ProductPrice } from './value-objects/product-price'
import type { SKU } from './value-objects/sku'

interface ProductProps {
  sku: SKU
  name: string
  price: ProductPrice
}

export class Product {
  readonly id: string
  private readonly props: ProductProps

  private constructor(props: ProductProps, id: string) {
    this.props = props
    this.id = id
  }

  static create(props: ProductProps, id?: string): Product {
    return new Product(props, id ?? randomUUID())
  }

  get sku(): string { return this.props.sku.value }
  get name(): string { return this.props.name }
  get price(): number { return this.props.price.value }
}
