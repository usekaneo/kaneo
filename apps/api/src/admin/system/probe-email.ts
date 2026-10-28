import { verifySmtpConnection } from "@kaneo/email";
import { safeErrorCode } from "./safe-error-code";
import type { ServiceStatus } from "./service-status";
import { withTimeout } from "./with-timeout";

type EmailProbe = {
  status: ServiceStatus;
  configured: boolean;
  errorCode: string | null;
};

export async function probeEmail(timeoutMs: number): Promise<EmailProbe> {
  try {
    // nodemailer bounds each phase itself; the outer limit covers DNS.
    const result = await withTimeout(
      () => verifySmtpConnection(timeoutMs),
      timeoutMs,
    );
    if (result.status === "not_configured") {
      return { status: "not_configured", configured: false, errorCode: null };
    }
    if (result.status === "ok") {
      return { status: "ok", configured: true, errorCode: null };
    }
    return { status: "down", configured: true, errorCode: result.code };
  } catch (error) {
    return {
      status: "down",
      configured: true,
      errorCode: safeErrorCode(error),
    };
  }
}
