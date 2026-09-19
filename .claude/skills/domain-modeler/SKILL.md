---
name: domain-modeler
description: Modelagem de domínio CaseCellShop. Use antes de criar qualquer entity ou value-object. Extrai VOs, define invariantes e valida nomenclatura contra CONTEXT.md.
---

# Domain Modeler — CaseCellShop

## Processo

### 1. Contexto
Leia `CONTEXT.md` e o módulo em questão (`src/modules/<módulo>/entities/`).

### 2. Identificar candidatos a Value Object

Para cada campo da entity proposta, pergunte:
- Tem validação própria? (formato, range, regra de negócio)
- Tem comportamento próprio? (métodos, transformações)
- É comparado por valor, não por identidade?

Se sim para qualquer um → é VO.

Exemplos de extração:
```
ProductPrice  → não pode ser negativo, arredondamento monetário
SKU           → formato validado (ex: regex)
Quantity      → inteiro positivo, sem zero
OrderStatus   → enum com transições válidas (PENDING → PROCESSING → CONFIRMED | FAILED)
```

### 3. Definir invariantes da entity

Para cada regra de negócio identificada, decida:
- Pertence à **entity** (invariante estrutural — ex: "preço não pode ser negativo")
- Pertence ao **use-case** (regra de aplicação — ex: "estoque insuficiente bloqueia checkout")

Nunca coloque regra de aplicação dentro da entity.

### 4. Validar nomenclatura

- Nome da entity alinhado com `CONTEXT.md`? Se não, proponha atualização do glossário
- VOs em `entities/value-objects/` com sufixo explícito no nome? (ex: `product-price.ts`, não `price.ts`)

### 5. Saída

Antes de qualquer código, apresente:

```
Entity: Product
Campos:
  - id: string (UUID)
  - name: string
  - price: ProductPrice (VO)
  - sku: SKU (VO)
  - stockQuantity: Quantity (VO)

Value Objects a criar:
  - ProductPrice: valor monetário > 0, 2 casas decimais
  - SKU: string não vazia, formato [A-Z0-9-]+
  - Quantity: inteiro >= 0

Invariantes da entity:
  - Product com stockQuantity = 0 é válido (esgotado, não inválido)

Invariantes do use-case (NÃO na entity):
  - Checkout bloqueado se stockQuantity < quantidade solicitada
```

Aguarde aprovação antes de gerar código.
