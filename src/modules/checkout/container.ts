import 'reflect-metadata'
import { container } from 'tsyringe'
import { prisma } from '@shared/database/prisma-client'
import { PrismaOrderRepository } from './infra/persistence/prisma-order-repository'
import { PrismaStockReservationRepository } from './infra/persistence/prisma-stock-reservation-repository'
import { PrismaCheckoutOutboxRepository } from './infra/persistence/prisma-checkout-outbox-repository'
import { PrismaProductStockChecker } from './infra/persistence/prisma-product-stock-checker'
import { PrismaCheckoutStockFlowWriter } from './infra/persistence/prisma-checkout-stock-flow-writer'
import { CreateCheckoutUseCase } from './use-cases/create-checkout/create-checkout'
import { GetOrderStatusUseCase } from './use-cases/get-order-status/get-order-status'
import { ProcessCheckoutJobUseCase } from './use-cases/process-checkout-job/process-checkout-job'
import { BullMQCheckoutRelay } from './infra/queue/bullmq-checkout-relay'
import { BullMQCheckoutWorker } from './infra/queue/bullmq-checkout-worker'
import { CheckoutController } from './infra/http/checkout-controller'
import { OrderStatusController } from './infra/http/order-status-controller'
import type { IOrderRepository } from './repositories/order-repository'
import type { IStockReservationRepository } from './repositories/stock-reservation-repository'
import type { ICheckoutOutboxRepository } from './repositories/checkout-outbox-repository'
import type { IProductStockChecker } from './repositories/product-stock-checker'
import type { ICheckoutStockFlowWriter } from './repositories/checkout-stock-flow-writer'
import type { Redis } from 'ioredis'

export function registerCheckoutModule(redis: Redis): void {
  const orderRepo = new PrismaOrderRepository(prisma)
  const reservationRepo = new PrismaStockReservationRepository(prisma)
  const outboxRepo = new PrismaCheckoutOutboxRepository(prisma)
  const stockChecker = new PrismaProductStockChecker(prisma)
  const stockFlowWriter = new PrismaCheckoutStockFlowWriter(prisma)

  container.register<IOrderRepository>('IOrderRepository', { useValue: orderRepo })
  container.register<IStockReservationRepository>('IStockReservationRepository', { useValue: reservationRepo })
  container.register<ICheckoutOutboxRepository>('ICheckoutOutboxRepository', { useValue: outboxRepo })
  container.register<IProductStockChecker>('IProductStockChecker', { useValue: stockChecker })
  container.register<ICheckoutStockFlowWriter>('ICheckoutStockFlowWriter', { useValue: stockFlowWriter })

  container.register(CreateCheckoutUseCase, {
    useFactory: () => new CreateCheckoutUseCase(
      container.resolve<IOrderRepository>('IOrderRepository'),
      container.resolve<IStockReservationRepository>('IStockReservationRepository'),
      container.resolve<ICheckoutOutboxRepository>('ICheckoutOutboxRepository'),
      container.resolve<IProductStockChecker>('IProductStockChecker'),
    ),
  })
  container.register(GetOrderStatusUseCase, {
    useFactory: () => new GetOrderStatusUseCase(
      container.resolve<IOrderRepository>('IOrderRepository'),
    ),
  })
  container.register(ProcessCheckoutJobUseCase, {
    useFactory: () => new ProcessCheckoutJobUseCase(
      container.resolve<IOrderRepository>('IOrderRepository'),
      container.resolve<IStockReservationRepository>('IStockReservationRepository'),
      container.resolve<ICheckoutOutboxRepository>('ICheckoutOutboxRepository'),
      container.resolve<ICheckoutStockFlowWriter>('ICheckoutStockFlowWriter'),
    ),
  })

  container.register(CheckoutController, {
    useFactory: () => new CheckoutController(container.resolve(CreateCheckoutUseCase)),
  })
  container.register(OrderStatusController, {
    useFactory: () => new OrderStatusController(container.resolve(GetOrderStatusUseCase)),
  })

  container.register(BullMQCheckoutRelay, {
    useFactory: () => new BullMQCheckoutRelay(
      container.resolve<ICheckoutOutboxRepository>('ICheckoutOutboxRepository'),
      redis,
    ),
  })
  container.register(BullMQCheckoutWorker, {
    useFactory: () => new BullMQCheckoutWorker(
      container.resolve(ProcessCheckoutJobUseCase),
      container.resolve<ICheckoutOutboxRepository>('ICheckoutOutboxRepository'),
      container.resolve<IOrderRepository>('IOrderRepository'),
      redis,
    ),
  })
}
