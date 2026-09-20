import type { ErpStockFlow } from '../dtos/erp-stock-flow-dto'

export interface IErpStockFlowRepository {
  findSince(since: Date): Promise<ErpStockFlow[]>
}
