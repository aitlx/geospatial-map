import nodemailer from "nodemailer";

const resolveTransporter = () => {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SERVICE,
    NODE_CODE_SENDING_EMAIL_ADDRESS,
    NODE_CODE_SENDING_EMAIL_PASSWORD,
  } = process.env;

  const fromAddress = process.env.SMTP_FROM || NODE_CODE_SENDING_EMAIL_ADDRESS || SMTP_USER;

  if (!fromAddress) {
    throw new Error("Email sender address is not configured");
  }

  const useCustomHost = Boolean(SMTP_HOST && SMTP_PORT);

  const authUser = SMTP_USER || NODE_CODE_SENDING_EMAIL_ADDRESS;
  const authPass = SMTP_PASS || NODE_CODE_SENDING_EMAIL_PASSWORD;

  if (!authUser || !authPass) {
    throw new Error("Email credentials are not configured");
  }

  if (useCustomHost) {
    return {
      transporter: nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: String(SMTP_SECURE).toLowerCase() === "true",
        auth: {
          user: authUser,
          pass: authPass,
        },
      }),
      fromAddress,
    };
  }

  return {
    transporter: nodemailer.createTransport({
      service: SMTP_SERVICE || "Gmail",
      auth: {
        user: authUser,
        pass: authPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    }),
    fromAddress,
  };
};

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const { transporter, fromAddress } = resolveTransporter();

    const friendlyName = process.env.SMTP_FROM_NAME || process.env.NODE_CODE_SENDING_NAME || "GeoAgri Support";
    const mailOptions = {
      from: friendlyName ? `${friendlyName} <${fromAddress}>` : fromAddress,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info?.messageId || "(pending id)"}`);
    return info;
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error("Could not send email", { cause: error });
  }
};
