import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function getFromAddress() {
  return process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
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
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const from = getFromAddress();

  if (!from) {
    throw new Error("RESEND_FROM is not configured");
  }

  console.log("[RESEND] Sending customer OTP email:", {
    from: maskEmail(from),
    to: maskEmail(to)
  });

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
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

    if (error) {
      console.error("[RESEND] Customer OTP email failed:", {
        name: error?.name,
        message: error?.message,
        statusCode: error?.statusCode,
        error
      });

      throw new Error(error.message || "Resend email delivery failed");
    }

    console.log("[RESEND] Customer OTP email sent:", {
      id: data?.id || null,
      to: maskEmail(to)
    });

    return data;
  } catch (error) {
    console.error("[RESEND] Customer OTP email failed:", {
      name: error?.name,
      message: error?.message,
      statusCode: error?.statusCode
    });

    throw error;
  }
}
