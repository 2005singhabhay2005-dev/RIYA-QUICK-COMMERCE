import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure =
  String(process.env.SMTP_SECURE || "true").toLowerCase() === "true";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

function getFromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER;
}

function maskEmail(email) {
  if (!email || !email.includes("@")) {
    return "***";
  }

  const [localPart, domain] = email.split("@");

  if (localPart.length <= 2) {
    return `***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

export async function sendCustomerEmailOtp({
  to,
  customerName,
  otp
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP credentials are not configured");
  }

  console.log("[SMTP] Sending customer OTP email:", {
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpSecure,
    user: maskEmail(process.env.SMTP_USER),
    from: maskEmail(getFromAddress()),
    to: maskEmail(to)
  });

  try {
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject: "Verify your Riya Solar account",
      text: [
        `Hello ${customerName},`,
        "",
        `Your Riya Solar verification OTP is: ${otp}`,
        "",
        "This OTP is valid for 10 minutes.",
        "Do not share this OTP with anyone.",
        "",
        "If you did not create this account, you can ignore this email.",
        "",
        "Riya Solar"
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#17231c">
          <h2 style="margin:0 0 12px;">Verify your Riya Solar account</h2>

          <p>Hello ${customerName},</p>

          <p>Use the following OTP to verify your email address:</p>

          <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px 20px;margin:20px 0;background:#f3f7f4;border-radius:10px;text-align:center;">
            ${otp}
          </div>

          <p>This OTP is valid for <strong>10 minutes</strong>.</p>

          <p style="color:#66736b;">
            Do not share this OTP with anyone.
          </p>

          <p style="color:#66736b;">
            If you did not create this account, you can ignore this email.
          </p>

          <p>Riya Solar</p>
        </div>
      `
    });
  } catch (error) {
    console.error("[SMTP] Customer OTP email failed:", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode,
      response: error?.response
    });

    throw error;
  }
}