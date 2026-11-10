CREATE OR REPLACE FUNCTION quills_migrations.current_schema_manifest() RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
SELECT jsonb_build_object(
 'tables',coalesce((SELECT jsonb_object_agg(t.relname,jsonb_build_object(
   'rls',t.relrowsecurity,'forceRls',t.relforcerowsecurity,
   'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped),
   'constraints',(SELECT jsonb_object_agg(c.conname,jsonb_build_object('definition',pg_get_constraintdef(c.oid),'validated',c.convalidated)) FROM pg_constraint c WHERE c.conrelid=t.oid AND c.conparentid=0),
   'indexes',(SELECT jsonb_object_agg(i.relname,pg_get_indexdef(i.oid)) FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid WHERE x.indrelid=t.oid),
   'policies',(SELECT jsonb_object_agg(p.polname,jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT jsonb_agg(coalesce(r.rolname,'PUBLIC') ORDER BY r.rolname) FROM unnest(p.polroles) role_id LEFT JOIN pg_roles r ON r.oid=role_id),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))) FROM pg_policy p WHERE p.polrelid=t.oid),
   'triggers',(SELECT jsonb_object_agg(tr.tgname,jsonb_build_object('definition',pg_get_triggerdef(tr.oid),'enabled',tr.tgenabled)) FROM pg_trigger tr WHERE tr.tgrelid=t.oid AND NOT tr.tgisinternal)
 )) FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='quills' AND t.relkind IN ('r','p') AND NOT t.relispartition),'{}'::jsonb),
 'sharedTriggers',coalesce((SELECT jsonb_object_agg(t.relname||'.'||tr.tgname,jsonb_build_object('definition',pg_get_triggerdef(tr.oid),'enabled',tr.tgenabled)) FROM pg_trigger tr JOIN pg_class t ON t.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND tr.tgname LIKE 'quills_%' AND NOT tr.tgisinternal),'{}'::jsonb),
 'functions',coalesce((SELECT jsonb_object_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='quills' AND p.prokind='f'),'{}'::jsonb)
);
$$;

--> statement-breakpoint
SELECT quills_migrations.capture_schema_manifest();
