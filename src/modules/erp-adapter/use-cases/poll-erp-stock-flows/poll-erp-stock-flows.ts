import 'reflect-metadata'
import { injectable, inject } from 'tsyringe'
import { type Either, right } from '@shared/core/either'
import type { IUseCase } from '@shared/core/use-case'
import type { DomainError } from '@shared/errors/domain-error'
import type { IErpStockFlowRepository } from '../../repositories/erp-stock-flow-repository'
import type { IOutboxRepository } from '../../repositories/outbox-repository'
import type { ISyncCursorRepository } from '../../repositories/sync-cursor-repository'

export interface PollErpStockFlowsInput {}
export interface PollErpStockFlowsOutput { detected: number }

@injectable()
export class PollErpStockFlowsUseCase
  implements IUseCase<PollErpStockFlowsInput, Either<DomainError, PollErpStockFlowsOutput>>
{
  constructor(
    @inject('IErpStockFlowRepository') private readonly erpStockFlowRepository: IErpStockFlowRepository,
    @inject('IOutboxRepository') private readonly outboxRepository: IOutboxRepository,
    @inject('ISyncCursorRepository') private readonly syncCursorRepository: ISyncCursorRepository,
  ) {}

  async execute(_input: PollErpStockFlowsInput): Promise<Either<DomainError, PollErpStockFlowsOutput>> {
    const since = (await this.syncCursorRepository.findByEntity('stock_flow')) ?? new Date(0)
    const stockFlows = await this.erpStockFlowRepository.findSince(since)

    if (stockFlows.length === 0) return right({ detected: 0 })

    await this.outboxRepository.writeStockFlows(stockFlows)
    await this.syncCursorRepository.upsert('stock_flow', stockFlows[stockFlows.length - 1].movedAt)

    return right({ detected: stockFlows.length })
  }
}
