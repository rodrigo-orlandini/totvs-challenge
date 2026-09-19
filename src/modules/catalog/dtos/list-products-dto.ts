import type { PaginatedResult } from '@shared/types/pagination'

export interface ProductResponseItem {
  id: string
  sku: string
  name: string
  price: number
  availableQuantity: number
}

export interface ListProductsInput {
  page?: number
  limit?: number
}

export type ListProductsOutput = PaginatedResult<ProductResponseItem>
