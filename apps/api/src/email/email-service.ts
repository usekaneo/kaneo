import nodemailer from "nodemailer";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  tls?: {
    rejectUnauthorized: boolean;
  };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.warn(
        "SMTP configuration not found. Email service will be disabled."
      );
      return;
    }

    const config: EmailConfig = {
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false, // Accept self-signed certificates
      },
      // Add connection pooling and timeout settings for better stability
      pool: true,
      maxConnections: 5,
      maxMessages: 10,
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 60000, // 60 seconds
    };

    this.transporter = nodemailer.createTransport(config);
    this.isConfigured = true;

    // Verify the connection with retry logic
    this.verifyConnection();
  }

  private async verifyConnection(retries = 3): Promise<void> {
    if (!this.transporter) return;

    for (let i = 0; i < retries; i++) {
      try {
        await this.transporter.verify();
        console.log("SMTP server is ready to send emails");
        this.isConfigured = true;
        return;
      } catch (error) {
        console.warn(
          `SMTP connection attempt ${i + 1}/${retries} failed:`,
          error
        );
        if (i === retries - 1) {
          console.error("SMTP connection failed after all retries");
          this.isConfigured = false;
        } else {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      console.warn("Email service is not configured. Skipping email send.");
      return false;
    }

    try {
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
      const fromName = process.env.SMTP_FROM_NAME || "Kaneo";

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", result.messageId);
      return true;
    } catch (error: any) {
      console.error("Error sending email:", error);

      // Try to reconnect if connection was lost
      if (error?.code === "ESOCKET" || error?.code === "ECONNRESET") {
        console.log("Attempting to reconnect SMTP...");
        this.initializeTransporter();

        // Retry sending once after reconnection
        try {
          const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
          const fromName = process.env.SMTP_FROM_NAME || "Kaneo";

          const mailOptions = {
            from: `"${fromName}" <${fromEmail}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
          };

          const result = await this.transporter?.sendMail(mailOptions);
          console.log(
            "Email sent successfully after reconnection:",
            result?.messageId
          );
          return true;
        } catch (retryError) {
          console.error("Error sending email after reconnection:", retryError);
          return false;
        }
      }

      return false;
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }
}

// Export singleton instance
export const emailService = new EmailService();
