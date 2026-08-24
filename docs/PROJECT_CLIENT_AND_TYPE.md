# Cliente e tipo ao criar projeto

O modal **Criar um novo projeto** pede cliente (opcional) e tipo de projeto. Isso define as colunas iniciais do board e, se houver cliente, associa o projeto a ele.

## Campos

| Campo | Obrigatório | Observação |
| --- | --- | --- |
| Nome, ícone, chave | Sim | Iguais ao fluxo original do Kaneo |
| Cliente | Não | `project.client_id` é **nullable**. Criar sem cliente não gera erro 500 |
| Tipo | Sim (default) | Default: `development` |

Tipos: `development`, `maintenance`, `support`, `hr`, `marketing`, `operations`. Cada um cria um conjunto de colunas (ex.: Desenvolvimento → Backlog / A Fazer / Em progresso / Em revisão / Finalizadas). Em RH a coluna final usa o slug `filed` (não `archived`, reservado).

## API

- `GET /api/client?workspaceId=` — lista clientes do workspace
- `POST /api/client/ensure-default` — cria **Cliente padrão** (CNPJ `00000000000191`) se ainda não existir. O frontend chama **uma vez** por workspace, para não loopar 404
- `POST /api/project` — aceita `clientId` (opcional/null) e `projectType` (opcional)

## Banco

Migração `apps/api/drizzle/0038_project_client_and_type.sql`:

- tabela `client` (única por workspace + CNPJ)
- `project.project_type` NOT NULL, default `development`
- `project.client_id` **NULL permitido**, FK `ON DELETE SET NULL`

Não torne `client_id` NOT NULL de novo: inserts sem cliente voltam a falhar com 500.
