-- Existing editable built-in admins retain their customized permissions while
-- gaining the coding permission already included in newly seeded admin roles.
UPDATE workspace_role SET permission = jsonb_set(permission::jsonb, '{agent}',
  coalesce(permission::jsonb -> 'agent', '[]'::jsonb) || '["run_code"]'::jsonb)::text
WHERE role = 'admin' AND NOT coalesce(permission::jsonb -> 'agent', '[]'::jsonb) ? 'run_code';
