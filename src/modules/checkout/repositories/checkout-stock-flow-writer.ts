export interface ICheckoutStockFlowWriter {
  createSaleFlow(productId: string, quantity: number): Promise<void>
}
