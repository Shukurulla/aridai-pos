import auditLogModel from "../models/audit_log.model.js";

// obsidian/02-arxitektura/xavfsizlik/audit-log.md

const SENSITIVE = ["password", "token", "secret", "authorization", "jwt", "apikey", "pin"];

function redact(data) {
  if (data == null) return data;
  try {
    return JSON.parse(
      JSON.stringify(data, (key, value) =>
        SENSITIVE.some((s) => key.toLowerCase().includes(s)) ? "[REDACTED]" : value,
      ),
    );
  } catch {
    return undefined;
  }
}

function severityForKind(kind) {
  if (/cross_tenant|tenant_boundary|secret|branch_ip_mismatch|socket_tenant/.test(kind)) return "critical";
  if (/fail|denied|rate_limited|violation|unauthorized|forbidden|anomaly|discrepancy/.test(kind)) return "warn";
  return "info";
}

export const audit = {
  async log(event) {
    const doc = {
      kind: event.kind,
      severity: event.severity || severityForKind(event.kind),
      actor: event.actor,
      restaurantId: event.restaurantId,
      branchId: event.branchId,
      message: event.message,
      data: redact(event.data),
      ip: event.ip,
      userAgent: event.userAgent,
      endpoint: event.endpoint,
      method: event.method,
      ts: new Date(),
    };
    try {
      await auditLogModel.create(doc);
    } catch (err) {
      // Audit fail asosiy oqimni to'xtatmaydi
      console.error("AUDIT_LOG_FAIL", err.message);
    }
    // TODO (Phase 4): critical → real-time alert (Telegram/email)
  },
};

export default audit;
