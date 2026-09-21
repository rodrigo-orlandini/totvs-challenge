import type { IStockReservationRepository } from '../../repositories/stock-reservation-repository'

interface Reservation {
  productId: string
  quantity: number
  expiresAt: Date
  releasedAt: Date | null
  orderId: string
}

export class InMemoryStockReservationRepository implements IStockReservationRepository {
  private reservations: Reservation[] = []

  async getActiveQuantity(productId: string): Promise<number> {
    const now = new Date()
    return this.reservations
      .filter(r => r.productId === productId && r.expiresAt > now && r.releasedAt === null)
      .reduce((sum, r) => sum + r.quantity, 0)
  }

  async releaseByOrderId(orderId: string): Promise<void> {
    const now = new Date()
    this.reservations = this.reservations.map(r =>
      r.orderId === orderId ? { ...r, releasedAt: now } : r,
    )
  }

  // Test helper: inject an already-expired reservation
  addExpiredReservation(data: { productId: string; quantity: number }): void {
    this.reservations.push({
      ...data,
      orderId: 'expired-order',
      expiresAt: new Date(Date.now() - 1000),
      releasedAt: null,
    })
  }

  // Called by InMemoryOrderRepository via createWithReservationsAndOutbox
  addReservation(data: { productId: string; quantity: number; orderId: string; expiresAt: Date }): void {
    this.reservations.push({ ...data, releasedAt: null })
  }
}
