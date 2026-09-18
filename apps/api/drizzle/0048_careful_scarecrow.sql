CREATE TABLE "activity_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"app" text DEFAULT '' NOT NULL,
	"domain" text DEFAULT '' NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"idle_seconds" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "activity_daily_unique" UNIQUE("workspace_id","user_id","day","app","domain")
);
--> statement-breakpoint
CREATE TABLE "activity_span" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"client_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp NOT NULL,
	"state" text NOT NULL,
	"app" text,
	"domain" text,
	CONSTRAINT "activity_span_device_client_unique" UNIQUE("device_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "agent_device" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"agent_version" text,
	"token_hash" text NOT NULL,
	"last_seen_at" timestamp,
	"last_state" text,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_device_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "agent_pairing_code" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_pairing_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "attendance_session" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"clock_in" timestamp NOT NULL,
	"clock_out" timestamp,
	"source" text DEFAULT 'web' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"work_days" text DEFAULT '1,2,3,4,5' NOT NULL,
	"work_start" text DEFAULT '09:00' NOT NULL,
	"work_end" text DEFAULT '17:00' NOT NULL,
	"break_minutes" integer DEFAULT 60 NOT NULL,
	"annual_leave_days" integer DEFAULT 15 NOT NULL,
	"overtime_rate_percent" integer DEFAULT 100 NOT NULL,
	"track_domains" boolean DEFAULT true NOT NULL,
	"activity_detail_days" integer DEFAULT 90 NOT NULL,
	"activity_summary_days" integer DEFAULT 365 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "department_workspace_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "employee_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"department_id" text,
	"join_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"work_days" text,
	"work_start" text,
	"work_end" text,
	"break_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employee_profile_workspace_user_unique" UNIQUE("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"spent_on" date NOT NULL,
	"project_id" text,
	"receipt_file_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_request" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" integer NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp,
	"decision_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_item" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text,
	"employee_name" text NOT NULL,
	"salary_type" text NOT NULL,
	"salary_amount" bigint NOT NULL,
	"worked_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_minutes" integer DEFAULT 0 NOT NULL,
	"base_amount" bigint NOT NULL,
	"overtime_amount" bigint DEFAULT 0 NOT NULL,
	"bonus" bigint DEFAULT 0 NOT NULL,
	"deduction" bigint DEFAULT 0 NOT NULL,
	"net_amount" bigint NOT NULL,
	"note" text,
	CONSTRAINT "payroll_item_run_user_unique" UNIQUE("run_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "payroll_run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"approved_by" text,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_run_workspace_period_unique" UNIQUE("workspace_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "salary" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"type" text DEFAULT 'monthly' NOT NULL,
	"effective_from" date NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stored_file" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"uploaded_by" text,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage" text NOT NULL,
	"object_key" text,
	"data" "bytea",
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "activity_daily" ADD CONSTRAINT "activity_daily_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_daily" ADD CONSTRAINT "activity_daily_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_span" ADD CONSTRAINT "activity_span_device_id_agent_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."agent_device"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_span" ADD CONSTRAINT "activity_span_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "activity_span" ADD CONSTRAINT "activity_span_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_device" ADD CONSTRAINT "agent_device_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_device" ADD CONSTRAINT "agent_device_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_pairing_code" ADD CONSTRAINT "agent_pairing_code_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "agent_pairing_code" ADD CONSTRAINT "agent_pairing_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "attendance_session" ADD CONSTRAINT "attendance_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "department" ADD CONSTRAINT "department_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "employee_profile" ADD CONSTRAINT "employee_profile_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "employee_profile" ADD CONSTRAINT "employee_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "employee_profile" ADD CONSTRAINT "employee_profile_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_receipt_file_id_stored_file_id_fk" FOREIGN KEY ("receipt_file_id") REFERENCES "public"."stored_file"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_item" ADD CONSTRAINT "payroll_item_run_id_payroll_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_run"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_item" ADD CONSTRAINT "payroll_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD CONSTRAINT "payroll_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD CONSTRAINT "payroll_run_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payroll_run" ADD CONSTRAINT "payroll_run_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salary" ADD CONSTRAINT "salary_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salary" ADD CONSTRAINT "salary_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "salary" ADD CONSTRAINT "salary_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "activity_daily_workspace_day_idx" ON "activity_daily" USING btree ("workspace_id","day");--> statement-breakpoint
CREATE INDEX "activity_span_user_startedAt_idx" ON "activity_span" USING btree ("workspace_id","user_id","started_at");--> statement-breakpoint
CREATE INDEX "activity_span_startedAt_idx" ON "activity_span" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "agent_device_workspace_user_idx" ON "agent_device" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "agent_pairing_code_userId_idx" ON "agent_pairing_code" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attendance_session_user_clockIn_idx" ON "attendance_session" USING btree ("workspace_id","user_id","clock_in");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_session_open_unique" ON "attendance_session" USING btree ("workspace_id","user_id") WHERE "attendance_session"."clock_out" is null;--> statement-breakpoint
CREATE INDEX "audit_log_workspace_createdAt_idx" ON "audit_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "employee_profile_departmentId_idx" ON "employee_profile" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "expense_workspace_status_idx" ON "expense" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "expense_workspace_user_idx" ON "expense" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "expense_projectId_idx" ON "expense" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "expense_receiptFileId_idx" ON "expense" USING btree ("receipt_file_id");--> statement-breakpoint
CREATE INDEX "leave_request_workspace_status_idx" ON "leave_request" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "leave_request_user_startDate_idx" ON "leave_request" USING btree ("workspace_id","user_id","start_date");--> statement-breakpoint
CREATE INDEX "salary_user_effectiveFrom_idx" ON "salary" USING btree ("workspace_id","user_id","effective_from");--> statement-breakpoint
CREATE INDEX "stored_file_workspaceId_idx" ON "stored_file" USING btree ("workspace_id");