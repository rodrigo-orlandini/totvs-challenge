import type { ICheckoutStockFlowWriter } from '../../repositories/checkout-stock-flow-writer'

export class InMemoryCheckoutStockFlowWriter implements ICheckoutStockFlowWriter {
  readonly flows: Array<{ productId: string; quantity: number }> = []

  async createSaleFlow(productId: string, quantity: number): Promise<void> {
    this.flows.push({ productId, quantity: -quantity })
  }
}
