import { injectable, inject } from 'tsyringe'
import { type Either, right } from '@shared/core/either'
import type { IUseCase } from '@shared/core/use-case'
import type { DomainError } from '@shared/errors/domain-error'
import type { IProductRepository } from '../../repositories/i-product-repository'
import type { ListProductsInput, ListProductsOutput } from '../../dtos/list-products-dto'

@injectable()
export class ListProductsUseCase
  implements IUseCase<ListProductsInput, Either<DomainError, ListProductsOutput>>
{
  constructor(
    @inject('IProductRepository') private readonly productRepository: IProductRepository,
  ) {}

  async execute(input: ListProductsInput): Promise<Either<DomainError, ListProductsOutput>> {
    const page = input.page ?? 1
    const limit = input.limit ?? 20
    const { products, total } = await this.productRepository.findAll({ page, limit })

    return right({
      data: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  }
}
