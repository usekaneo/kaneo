-- Enrich Arquitetura Demo — escopo: slug arquitetura-demo apenas.
BEGIN;

CREATE TEMP TABLE demo_ws ON COMMIT DROP AS
SELECT id FROM workspace WHERE slug = 'arquitetura-demo' LIMIT 1;

-- Rename + archive profiles
UPDATE project p SET
  name = CASE
    WHEN p.name ~* 'vista mar|bim' THEN 'Residencial Vista Mar — BIM (fluindo bem)'
    WHEN p.name ~* 'retrofit|aurora' THEN 'Retrofit Edifício Aurora (não flui)'
    WHEN p.name ~* 'marca|portf' THEN 'Marca & Portfólio 2026 (concluído)'
    WHEN p.name ~* 'people' THEN 'People — Studio Arquitetura (concluído)'
    WHEN p.name ~* 'moema|acompanhamento' THEN 'Acompanhamento de Obra — Moema (em andamento)'
    WHEN p.name ~* 'jardins|implanta' THEN 'Implantação Interiores Jardins (em andamento)'
    ELSE p.name
  END,
  archived_at = CASE
    WHEN p.name ~* 'marca|portf|people' OR p.name ~* 'concluído' THEN COALESCE(p.archived_at, NOW() - interval '14 days')
    WHEN p.name ~* 'vista mar|bim|retrofit|aurora|moema|acompanhamento|jardins|implanta' THEN NULL
    ELSE p.archived_at
  END
WHERE p.workspace_id = (SELECT id FROM demo_ws);

-- Re-apply archive after rename (names now include concluído)
UPDATE project p SET archived_at = COALESCE(archived_at, NOW() - interval '14 days')
WHERE p.workspace_id = (SELECT id FROM demo_ws)
  AND p.name ~* 'concluído';

UPDATE project p SET archived_at = NULL
WHERE p.workspace_id = (SELECT id FROM demo_ws)
  AND p.name !~* 'concluído';

-- Tag tasks with demo types + titles (deterministic by number)
WITH ranked AS (
  SELECT
    t.id AS task_id,
    t.number AS task_number,
    p.id AS project_id,
    p.name AS project_name,
    row_number() OVER (PARTITION BY p.id ORDER BY t.number) AS rn
  FROM task t
  JOIN project p ON p.id = t.project_id
  WHERE p.workspace_id = (SELECT id FROM demo_ws)
),
typed AS (
  SELECT
    r.*,
    CASE
      WHEN r.rn % 5 = 0 THEN 'reuniao'
      WHEN r.project_name ~* 'não flui' THEN
        (ARRAY['solicitacao','contract','orcamento','tsc','solicitacao'])[1 + ((r.rn - 1) % 5)]
      WHEN r.project_name ~* 'fluindo bem' THEN
        (ARRAY['contract','tsc','orcamento','reuniao','tsc'])[1 + ((r.rn - 1) % 5)]
      WHEN r.project_name ~* 'Moema' THEN
        (ARRAY['solicitacao','reuniao','tsc','orcamento','solicitacao'])[1 + ((r.rn - 1) % 5)]
      WHEN r.project_name ~* 'Jardins' THEN
        (ARRAY['orcamento','tsc','contract','solicitacao','orcamento'])[1 + ((r.rn - 1) % 5)]
      WHEN r.project_name ~* 'concluído' THEN
        (ARRAY['contract','orcamento','tsc','solicitacao','reuniao'])[1 + ((r.rn - 1) % 5)]
      ELSE
        (ARRAY['contract','solicitacao','orcamento','tsc','reuniao'])[1 + ((r.rn - 1) % 5)]
    END AS new_type
  FROM ranked r
),
titled AS (
  SELECT
    typed.*,
    CASE new_type
      WHEN 'contract' THEN (ARRAY[
        'Contrato de projeto executivo — torre residencial',
        'Aditivo contratual — escopo de interiores',
        'Contrato de coordenação BIM com consultoria',
        'Contrato de assistência à obra (CAO)',
        'Renovação de contrato de acompanhamento técnico',
        'Contrato de concepção — anteprojeto corporativo'
      ])[1 + ((rn + task_number) % 6)]
      WHEN 'solicitacao' THEN (ARRAY[
        'Solicitação de revisão de planta humanizada',
        'Solicitação de RFI — detalhe de peitoril',
        'Solicitação do cliente: alteração de layout sala',
        'Solicitação de liberação de prancha para obra',
        'Solicitação de memorial de acabamentos atualizado',
        'Solicitação de visita técnica ao canteiro'
      ])[1 + ((rn + task_number) % 6)]
      WHEN 'orcamento' THEN (ARRAY[
        'Orçamento de fachada ventilada — opção A/B',
        'Orçamento de esquadrias alumínio / PVC',
        'Orçamento de impermeabilização de cobertura',
        'Orçamento de mobiliário sob medida — living',
        'Orçamento de paisagismo terraço',
        'Orçamento de retrofit de HVAC — pavimento tipo'
      ])[1 + ((rn + task_number) % 6)]
      WHEN 'tsc' THEN (ARRAY[
        'TSC — memorial descritivo pavimento tipo',
        'TSC — especificação de revestimentos molhados',
        'TSC — quadro de esquadrias e ferragens',
        'TSC — caderno de detalhamento de fachada',
        'TSC — lista de materiais AS-BUILT',
        'TSC — critérios de aceitação de obra'
      ])[1 + ((rn + task_number) % 6)]
      ELSE (ARRAY[
        'Reunião de kickoff com incorporadora',
        'Reunião semanal de obra com construtora',
        'Reunião de compatibilização MEP × arquitetura',
        'Reunião de alinhamento comercial com cliente'
      ])[1 + ((rn + task_number) % 4)]
    END AS new_title
  FROM typed
),
cols AS (
  SELECT
    c.id,
    c.project_id,
    c.slug,
    c.position,
    c.is_final,
    row_number() OVER (PARTITION BY c.project_id ORDER BY c.position) AS col_rn,
    count(*) OVER (PARTITION BY c.project_id) AS col_count,
    count(*) FILTER (WHERE c.is_final) OVER (PARTITION BY c.project_id) AS final_count
  FROM "column" c
  JOIN project p ON p.id = c.project_id
  WHERE p.workspace_id = (SELECT id FROM demo_ws)
),
chosen AS (
  SELECT
    ti.task_id,
    ti.new_type,
    ti.new_title,
    ti.project_name,
    ti.rn,
    CASE
      WHEN ti.project_name ~* 'concluído' THEN
        (SELECT id FROM cols c WHERE c.project_id = ti.project_id AND c.is_final ORDER BY c.position DESC LIMIT 1)
      WHEN ti.project_name ~* 'não flui' THEN
        (SELECT id FROM cols c WHERE c.project_id = ti.project_id AND NOT c.is_final ORDER BY c.position ASC LIMIT 1 OFFSET LEAST(ti.rn % 2, 1))
      WHEN ti.project_name ~* 'fluindo bem' THEN
        (SELECT id FROM cols c WHERE c.project_id = ti.project_id ORDER BY
           CASE WHEN c.is_final THEN 0 WHEN c.position > 1 THEN 1 ELSE 2 END, c.position
         OFFSET (ti.rn % GREATEST((SELECT count(*) FROM cols c2 WHERE c2.project_id = ti.project_id),1)) LIMIT 1)
      ELSE
        (SELECT id FROM cols c WHERE c.project_id = ti.project_id ORDER BY c.position
         OFFSET (ti.rn % GREATEST((SELECT count(*) FROM cols c2 WHERE c2.project_id = ti.project_id),1)) LIMIT 1)
    END AS column_id,
    CASE
      WHEN ti.project_name ~* 'não flui' THEN (ARRAY['urgent','high','urgent','high','medium'])[1 + ((ti.rn - 1) % 5)]
      WHEN ti.project_name ~* 'concluído' THEN (ARRAY['low','medium','no-priority'])[1 + ((ti.rn - 1) % 3)]
      WHEN ti.project_name ~* 'fluindo bem' THEN (ARRAY['medium','low','high','medium'])[1 + ((ti.rn - 1) % 4)]
      ELSE (ARRAY['medium','high','low','medium'])[1 + ((ti.rn - 1) % 4)]
    END AS new_priority,
    CASE
      WHEN ti.project_name ~* 'concluído' THEN NOW() - ((20 + (ti.rn % 40)) || ' days')::interval
      WHEN ti.project_name ~* 'não flui' THEN
        CASE WHEN ti.rn % 5 = 0 THEN NOW() + interval '5 days' ELSE NOW() - ((3 + (ti.rn % 30)) || ' days')::interval END
      WHEN ti.project_name ~* 'fluindo bem' THEN
        CASE WHEN ti.rn % 10 = 0 THEN NOW() - interval '2 days' ELSE NOW() + ((3 + (ti.rn % 25)) || ' days')::interval END
      ELSE
        CASE WHEN ti.rn % 6 = 0 THEN NOW() - ((1 + (ti.rn % 8)) || ' days')::interval ELSE NOW() + ((2 + (ti.rn % 20)) || ' days')::interval END
    END AS new_due
  FROM titled ti
)
UPDATE task t SET
  title = c.new_title,
  task_type = c.new_type,
  column_id = c.column_id,
  status = (SELECT slug FROM "column" col WHERE col.id = c.column_id),
  priority = c.new_priority,
  due_date = c.new_due,
  updated_at = NOW()
FROM chosen c
WHERE t.id = c.task_id
  AND c.column_id IS NOT NULL;

-- Contract submissions for contract tasks (up to 12 new)
INSERT INTO contract_submission (
  id, workspace_id, project_id, task_id, client_id, template_id,
  docuseal_submission_id, status, submitters, created_by, created_at, updated_at
)
SELECT
  encode(gen_random_bytes(12), 'hex'),
  p.workspace_id,
  p.id,
  t.id,
  (SELECT cl.id FROM client cl WHERE cl.workspace_id = p.workspace_id ORDER BY cl.id LIMIT 1),
  (SELECT ct.id FROM contract_template ct WHERE ct.workspace_id = p.workspace_id LIMIT 1),
  'demo-enrich-' || encode(gen_random_bytes(8), 'hex'),
  (ARRAY['pending','sent','completed','declined'])[1 + ((row_number() OVER (ORDER BY t.number) - 1) % 4)],
  jsonb_build_array(jsonb_build_object(
    'name', 'Cliente Demo',
    'email', 'assinatura@arquitetura.demo.br',
    'role', 'cliente',
    'status', 'pending'
  )),
  (SELECT u.id FROM "user" u WHERE lower(u.email) LIKE 'contato@%' LIMIT 1),
  NOW(),
  NOW()
FROM task t
JOIN project p ON p.id = t.project_id
WHERE p.workspace_id = (SELECT id FROM demo_ws)
  AND t.task_type = 'contract'
  AND NOT EXISTS (SELECT 1 FROM contract_submission cs WHERE cs.task_id = t.id)
  AND EXISTS (SELECT 1 FROM contract_template ct WHERE ct.workspace_id = p.workspace_id)
  AND EXISTS (SELECT 1 FROM client cl WHERE cl.workspace_id = p.workspace_id)
ORDER BY t.number
LIMIT 12;

-- Labels
INSERT INTO label (id, name, color, workspace_id, task_id, created_at, updated_at)
SELECT encode(gen_random_bytes(12), 'hex'), v.name, v.color, (SELECT id FROM demo_ws), NULL, NOW(), NOW()
FROM (VALUES
  ('urgente', '#DC2626'),
  ('contrato', '#0F766E'),
  ('orcamento', '#CA8A04'),
  ('tsc', '#7C3AED'),
  ('solicitacao', '#2563EB'),
  ('bloqueado', '#991B1B')
) AS v(name, color)
WHERE NOT EXISTS (
  SELECT 1 FROM label l
  WHERE l.workspace_id = (SELECT id FROM demo_ws)
    AND l.name = v.name
    AND l.task_id IS NULL
);

-- Reports
SELECT 'projects' AS metric, count(*)::text AS value FROM project WHERE workspace_id = (SELECT id FROM demo_ws)
UNION ALL SELECT 'archived', count(*)::text FROM project WHERE workspace_id = (SELECT id FROM demo_ws) AND archived_at IS NOT NULL
UNION ALL SELECT 'tasks', count(*)::text FROM task t JOIN project p ON p.id = t.project_id WHERE p.workspace_id = (SELECT id FROM demo_ws)
UNION ALL SELECT 'contracts', count(*)::text FROM contract_submission WHERE workspace_id = (SELECT id FROM demo_ws);

SELECT t.task_type, count(*) AS n
FROM task t
JOIN project p ON p.id = t.project_id
WHERE p.workspace_id = (SELECT id FROM demo_ws)
  AND t.task_type IN ('contract','solicitacao','orcamento','tsc','reuniao')
GROUP BY t.task_type
ORDER BY n DESC;

SELECT p.name,
       count(*) FILTER (
         WHERE t.due_date < NOW()
           AND NOT EXISTS (SELECT 1 FROM "column" c WHERE c.id = t.column_id AND c.is_final)
       ) AS overdue,
       count(*) FILTER (
         WHERE EXISTS (SELECT 1 FROM "column" c WHERE c.id = t.column_id AND c.is_final)
       ) AS done,
       count(*) AS total,
       p.archived_at IS NOT NULL AS archived
FROM task t
JOIN project p ON p.id = t.project_id
WHERE p.workspace_id = (SELECT id FROM demo_ws)
GROUP BY p.id, p.name, p.archived_at
ORDER BY p.name;

COMMIT;
