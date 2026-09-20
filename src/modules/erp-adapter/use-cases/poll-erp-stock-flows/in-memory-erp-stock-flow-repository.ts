import type { IErpStockFlowRepository } from '../../repositories/erp-stock-flow-repository'
import type { ErpStockFlow } from '../../dtos/erp-stock-flow-dto'

export class InMemoryErpStockFlowRepository implements IErpStockFlowRepository {
  stockFlows: ErpStockFlow[] = []

  async findSince(since: Date): Promise<ErpStockFlow[]> {
    return this.stockFlows.filter(sf => sf.movedAt > since)
  }
}
