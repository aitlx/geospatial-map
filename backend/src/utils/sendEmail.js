import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
        pass: process.env.NODE_CODE_SENDING_EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false, 
      },
    });

    const mailOptions = {
      from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info.messageId}`);
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error("Could not send email");
  }
};
