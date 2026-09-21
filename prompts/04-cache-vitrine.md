# 04 — Cache da Vitrine

## Objetivo

Adicionar camadas de cache para a vitrine (listagem de produtos), reduzindo carga no banco de dados e aumentando resiliência.

## Contexto

Vitrine expõe `GET /products` via `ListProductsUseCase`. Sem cache, cada requisição vai direto ao Postgres. Com o crescimento de acessos, a leitura precisa ser protegida por cache.

## Prompt

> Vamos trabalhar nas camadas de cache para a vitrine. Vamos seguir uma abordagem com cache local, cache-aside e refresh ahead. Adicione um cache local na aplicação que servirá como uma primeira linha para filtrar as solicitações ao banco de dados e como um fallback para uma possível falha da próxima camada de cache, que seria um cache-aside com o Redis que temos configurado. Use um TTL em torno de 10 minutos, com uma estratégia de adicionar um Jitter (mais ou menos 10 segundos) para evitar que todas as chaves expirem juntas, porém com um mecanismo de invalidação vinculado ao serviço de sincronização de bases entre o ERP e o banco de dados da loja, dessa forma, sempre que uma alteração ocorrer em algum produto, o serviço de sincronização invalida o cache obsoleto e registra um novo nas duas camadas. Quando o TTL estiver próximo de expirar, para evitar o cache stampede, podemos também utilizar a estratégia de refresh-ahead para antecipar a renovação do cache com um worker separado para realizar o scheduling dessa renovação.

## Critérios de Direcionamento

_A preencher após brainstorming_

## Resultado

_A preencher após implementação_

## Revisões

_A preencher se houver iterações_
