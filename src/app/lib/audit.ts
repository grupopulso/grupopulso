import { createClient } from "@/app/lib/supabase/server";

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "payment"
  | "receipt"
  | "other";

type CreateAuditLogInput = {
  module: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  description: string;
  oldData?: unknown;
  newData?: unknown;
};

export async function createAuditLog({
  module,
  action,
  entityType,
  entityId,
  description,
  oldData,
  newData,
}: CreateAuditLogInput) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("audit_logs")
    .insert({
      user_id:
        user?.id ?? null,

      module,

      action,

      entity_type:
        entityType ?? null,

      entity_id:
        entityId ?? null,

      description,

      old_data:
        oldData ?? null,

      new_data:
        newData ?? null,
    });

  if (error) {
    console.error(
      "Erro ao registrar auditoria:",
      error
    );
  }
}