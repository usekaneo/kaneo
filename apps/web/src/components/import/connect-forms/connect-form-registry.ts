import type { ComponentType } from "react";
import type { ConnectFormProps } from "@/components/import/connect-forms/connect-form-props";
import { KaneoConnectForm } from "@/components/import/connect-forms/kaneo-connect-form";
import { LinearConnectForm } from "@/components/import/connect-forms/linear-connect-form";
import { PlaneConnectForm } from "@/components/import/connect-forms/plane-connect-form";
import { PlankaConnectForm } from "@/components/import/connect-forms/planka-connect-form";
import { TrelloConnectForm } from "@/components/import/connect-forms/trello-connect-form";
import type { ImportSourceId } from "@/components/import/import-source-definitions";

export const CONNECT_FORMS: Record<
  ImportSourceId,
  ComponentType<ConnectFormProps>
> = {
  linear: LinearConnectForm,
  trello: TrelloConnectForm,
  plane: PlaneConnectForm,
  planka: PlankaConnectForm,
  kaneo: KaneoConnectForm,
};
