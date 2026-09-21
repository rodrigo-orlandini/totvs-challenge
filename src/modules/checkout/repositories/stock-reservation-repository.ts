export interface IStockReservationRepository {
  getActiveQuantity(productId: string): Promise<number>
  releaseByOrderId(orderId: string): Promise<void>
}
