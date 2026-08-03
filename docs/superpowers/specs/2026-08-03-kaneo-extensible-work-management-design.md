# Kaneo extensível para gestão de engenharia, desenvolvimento e vida pessoal

## 1. Objetivo

Evoluir o Kaneo para uma plataforma de gestão altamente configurável, preservando sua simplicidade visual e seu desempenho. A solução deve atender inicialmente projetos de engenharia, desenvolvimento de ferramentas e atividades pessoais, sem fixar esses domínios no código.

O produto deve permitir que novas frentes, tipos de trabalho e métodos de organização sejam criados por configuração. A referência funcional é a flexibilidade do ClickUp; a referência visual continua sendo o Kaneo atual.

## 2. Princípios aprovados

- Capacidade avançada com apresentação minimalista e progressiva.
- Nenhum recurso novo deve descaracterizar a interface atual.
- Recursos avançados aparecem em painéis laterais, menus contextuais e configurações, não permanentemente no quadro.
- Configurações seguem a herança `workspace -> projeto -> usuário`.
- Um nível inferior pode sobrescrever o nível anterior sem alterar o padrão compartilhado.
- Engenharia, desenvolvimento e pessoal são modelos iniciais, não estruturas rígidas.
- Visualizações diferentes usam as mesmas tarefas e permanecem sincronizadas.
- Novos tipos de campo, regras e visualizações devem ser acrescentados por módulos independentes.

## 3. Abordagem escolhida

Foi escolhida a abordagem minimalista progressiva. Ela preserva o uso rápido do Kaneo e concentra a complexidade em configurações acessadas sob demanda.

Foram rejeitadas como padrão:

- A interface densa semelhante ao ClickUp, por aumentar a carga visual.
- A duplicação em modos simples e avançado, por gerar comportamentos paralelos e maior custo de manutenção.

## 4. Modelo de configuração

### 4.1 Herança

1. O workspace define padrões globais.
2. Um modelo pode fornecer uma configuração reutilizável.
3. O projeto herda o workspace ou o modelo e pode sobrescrever valores permitidos.
4. O usuário pode salvar preferências pessoais de visualização, filtros, agrupamentos e ordenação.

As preferências pessoais não alteram dados ou regras compartilhadas. Regras de negócio do projeto somente podem ser alteradas por usuários com permissão administrativa apropriada.

### 4.2 Tipos de item

O workspace pode criar tipos como tarefa, entrega, revisão, reunião, documento, bug, melhoria e atividade pessoal. Cada tipo possui nome, ícone, descrição, conjunto de campos, regras de validação e modelo opcional.

### 4.3 Campos personalizados

A primeira arquitetura deve aceitar texto, texto longo, número, moeda, data, seleção única, seleção múltipla, pessoa, caixa de seleção, URL, fórmula e relacionamento. Campos possuem identificador estável, rótulo editável, tipo, obrigatoriedade, valor padrão, opções, ordem e escopo.

Alterar um rótulo não pode invalidar filtros, regras ou dados existentes. Alterações destrutivas de tipo exigem validação de compatibilidade e confirmação explícita.

### 4.4 Fluxos e status

Cada projeto pode usar um fluxo próprio. Status possuem nome, cor, ordem e categoria semântica: não iniciado, ativo, concluído ou cancelado. Essa categoria permite relatórios consistentes mesmo quando os nomes variam entre projetos.

## 5. Visualizações sincronizadas

Cada projeto pode habilitar, ordenar, nomear e configurar suas visualizações. Kanban, Lista, Gantt e Eisenhower consultam a mesma fonte de tarefas. Alterações feitas em uma visualização são refletidas nas demais.

### 5.1 Kanban

Mantém o comportamento visual atual. O agrupamento padrão é por status, mas campos compatíveis podem ser usados como agrupadores. Informações adicionais aparecem nos cartões somente quando habilitadas na configuração da visualização.

### 5.2 Lista

Apresenta tarefas em linhas com colunas configuráveis, ordenação, filtros e edição direta de campos compatíveis. Configurações podem ser compartilhadas no projeto ou salvas apenas para o usuário.

### 5.3 Gantt

Usa data inicial, prazo, duração, progresso e dependências. Tarefas sem datas ficam em uma área de pendências do cronograma. O arraste pode ajustar datas, desde que o usuário tenha permissão e confirme impactos em dependências.

### 5.4 Matriz de Eisenhower

A matriz possui quatro quadrantes, cujos nomes, cores e ordem podem ser configurados. A classificação padrão é calculada por duas dimensões independentes: urgência e importância.

Urgência pode usar:

- Prazo e uma janela configurável em dias.
- Campo personalizado.
- Fórmula configurável.
- Definição manual.

Importância pode usar:

- Prioridade da tarefa.
- Campo personalizado.
- Fórmula configurável.
- Definição manual.

Cada dimensão aceita os modos automático, manual ou híbrido. No modo híbrido, a regra calcula o valor, mas uma substituição manual registrada na tarefa prevalece. O sistema mostra a origem da classificação e permite remover a substituição para voltar ao cálculo automático.

Uma tarefa recalcula seu quadrante quando prazo, prioridade, campos relacionados, regra ou data corrente mudam. A tarefa não é duplicada nem tem seu status alterado pela simples mudança de quadrante.

Arrastar uma tarefa para outro quadrante abre uma confirmação curta informando qual campo ou substituição será alterado. Quando a regra não tiver uma alteração inequívoca, o arraste cria uma substituição manual em vez de modificar o prazo arbitrariamente.

Tarefas sem dados suficientes aparecem no quadrante padrão configurado e recebem um indicador de classificação incompleta. Filtros podem restringir a matriz por responsável, etiqueta, tipo, período e qualquer campo filtrável.

## 6. Recursos funcionais

### 6.1 Organização do trabalho

- Subtarefas e checklists com progresso.
- Modelos de tarefas, checklists, fluxos, visualizações e projetos.
- Tarefas recorrentes com regras de repetição e tratamento de vencimentos.
- Dependências explícitas de bloqueio e espera.
- Arquivos e links associados à tarefa.
- Estimativa e registro de tempo.
- Filtros, agrupamentos, ordenações e visualizações salvas.

### 6.2 Visões transversais

- Meu Dia reúne tarefas atrasadas, atuais, próximas e de alta prioridade conforme filtros pessoais.
- Caixa de Entrada captura rapidamente uma pendência sem exigir classificação completa.
- Calendário Geral reúne tarefas dos projetos autorizados e permite filtros por workspace, projeto, tipo e responsável.
- Painéis usam componentes configuráveis, sem substituir as visualizações operacionais.

### 6.3 Automações

O mecanismo segue `gatilho -> condições -> ações`. Exemplos iniciais incluem mudança de status, proximidade do prazo, criação de tarefa, conclusão de subtarefas e alteração de campo. Ações incluem aplicar modelo, atribuir responsável, alterar campo, criar checklist, mover status e emitir notificação.

Automações devem possuir registro de execução, proteção contra ciclos, limite de repetição e opção de teste com prévia antes da ativação.

## 7. Arquitetura técnica

### 7.1 Backend

Os módulos seguem o padrão existente do Kaneo: rotas Hono, validação Valibot, controladores isolados, Drizzle ORM e eventos publicados para histórico e atualização em tempo real.

Os domínios principais serão separados em:

- Definições de tipos e campos.
- Valores de campos.
- Configurações e herança.
- Visualizações salvas.
- Relações e dependências.
- Recorrência.
- Registro de tempo.
- Automações.
- Classificação de Eisenhower.

A classificação da matriz deve ser uma função determinística e testável, usada tanto na API quanto no processamento agendado. Resultados derivados podem ser armazenados para busca rápida, mas a regra e os dados de origem permanecem a fonte de verdade.

### 7.2 Frontend

Cada visualização é um módulo de apresentação que consome uma consulta comum de tarefas, filtros e definições de campo. O seletor de visualizações permanece compacto na área do projeto.

Componentes visuais existentes devem ser reutilizados. Novos componentes seguem Tailwind e Radix já adotados pelo projeto. Configurações avançadas usam painéis laterais e seções progressivas; o quadro padrão não recebe barras permanentes desnecessárias.

### 7.3 Extensibilidade

Tipos de campo registram capacidades como editar, filtrar, ordenar, agrupar e usar em fórmula. Visualizações declaram campos obrigatórios e capacidades disponíveis. Regras referenciam identificadores estáveis, nunca rótulos editáveis.

Essa separação permite acrescentar novos tipos de campo ou visualizações sem modificar o núcleo de tarefas.

## 8. Fluxo de dados

1. O usuário cria ou altera uma tarefa em qualquer visualização.
2. A API valida permissões, campos e fluxo do projeto.
3. A alteração é persistida em transação.
4. Eventos de domínio registram atividade e invalidam dados derivados.
5. A classificação de Eisenhower e as automações aplicáveis são recalculadas.
6. Consultas afetadas são atualizadas e todas as visualizações refletem o mesmo estado.

Processamentos demorados, recorrências e automações em lote devem ocorrer fora da requisição interativa. O usuário recebe estado de processamento e resultado quando aplicável.

## 9. Permissões e segurança

- Permissões existentes de workspace e projeto continuam sendo a base.
- Configurar tipos, campos, fluxos e automações exige permissão específica.
- Visualizações pessoais podem ser criadas sem alterar padrões compartilhados.
- Valores sensíveis não são expostos em histórico, logs ou notificações.
- Uploads, URLs e expressões de fórmula são validados e sanitizados.
- Toda execução automática registra autor lógico, regra, entrada e resultado.

## 10. Tratamento de erros

- Configuração inválida é recusada antes de ser ativada.
- Campos ou regras incompatíveis apresentam impacto e alternativas de migração.
- Falhas em automações não revertem a alteração principal da tarefa; ficam registradas e podem ser reprocessadas com segurança.
- Conflitos de edição exibem a versão mais recente e evitam sobrescrita silenciosa.
- A interface preserva o último estado válido quando uma consulta falhar e oferece nova tentativa.
- Tarefas não classificáveis na matriz permanecem visíveis e informam o dado ausente.

## 11. Estratégia de implementação

O desenvolvimento será incremental para reduzir risco e evitar uma grande alteração simultânea:

1. Fundação configurável: definições, herança, tipos, campos e visualizações salvas.
2. Trabalho estruturado: subtarefas, checklists e modelos.
3. Visualizações: Lista e Matriz de Eisenhower.
4. Planejamento temporal: dependências, recorrência, Calendário e Gantt.
5. Produtividade transversal: Meu Dia, Caixa de Entrada e registro de tempo.
6. Automações e painéis configuráveis.

Cada etapa deve ser utilizável isoladamente e manter migrações compatíveis com os dados já existentes.

## 12. Testes e validação

- Testes unitários para herança, fórmulas, recorrência e classificação da matriz.
- Testes de integração para permissões, migrações, campos, dependências e automações.
- Testes de componente para editores, filtros, cartões e configurações.
- Testes de ponta a ponta para criar tarefa e visualizá-la sincronizada em Kanban, Lista, Gantt e Eisenhower.
- Testes de acessibilidade, teclado, responsividade e temas.
- Comparação visual das telas alteradas com o Kaneo atual para impedir regressões de densidade, espaçamento e hierarquia.
- Validação com modelos reais de engenharia, desenvolvimento e rotina pessoal antes de publicar no VPS.

## 13. Critérios de aceite

- O Kanban atual continua familiar e operacional.
- Uma tarefa editada em uma visualização aparece corretamente nas demais.
- A Matriz de Eisenhower se preenche e se atualiza automaticamente segundo regras configuráveis.
- O usuário consegue identificar e substituir manualmente uma classificação automática.
- Workspace, projeto e usuário respeitam a hierarquia de configuração.
- Uma nova frente de trabalho pode ser criada com tipos, campos, fluxo, modelos e visualizações sem alterar código.
- Recursos avançados não adicionam poluição visual ao uso básico.
- Migrações preservam projetos, tarefas e atividades já existentes.

## 14. Fora do escopo inicial

- Copiar integralmente o ClickUp.
- Criar um editor livre de dashboards antes das fundações configuráveis.
- Substituir ferramentas especializadas de cálculo, BIM, CAD ou controle financeiro.
- Implantar no VPS antes da validação local e da aprovação do usuário.
