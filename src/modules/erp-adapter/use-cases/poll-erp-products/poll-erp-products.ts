import 'reflect-metadata'
import { injectable, inject } from 'tsyringe'
import { type Either, right } from '@shared/core/either'
import type { IUseCase } from '@shared/core/use-case'
import type { DomainError } from '@shared/errors/domain-error'
import type { IErpProductRepository } from '../../repositories/erp-product-repository'
import type { IOutboxRepository } from '../../repositories/outbox-repository'
import type { ISyncCursorRepository } from '../../repositories/sync-cursor-repository'

export interface PollErpProductsInput {}
export interface PollErpProductsOutput { detected: number }

@injectable()
export class PollErpProductsUseCase
  implements IUseCase<PollErpProductsInput, Either<DomainError, PollErpProductsOutput>>
{
  constructor(
    @inject('IErpProductRepository') private readonly erpProductRepository: IErpProductRepository,
    @inject('IOutboxRepository') private readonly outboxRepository: IOutboxRepository,
    @inject('ISyncCursorRepository') private readonly syncCursorRepository: ISyncCursorRepository,
  ) {}

  async execute(_input: PollErpProductsInput): Promise<Either<DomainError, PollErpProductsOutput>> {
    const since = (await this.syncCursorRepository.findByEntity('product')) ?? new Date(0)
    const products = await this.erpProductRepository.findSince(since)

    if (products.length === 0) return right({ detected: 0 })

    await this.outboxRepository.writeProducts(products)
    await this.syncCursorRepository.upsert('product', products[products.length - 1].updatedAt)

    return right({ detected: products.length })
  }
}
