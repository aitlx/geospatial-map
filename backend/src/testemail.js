import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const testEmail = async () => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
        pass: process.env.NODE_CODE_SENDING_EMAIL_PASSWORD, 
      },
      tls: {
        rejectUnauthorized: false, 
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODE_CODE_SENDING_EMAIL_ADDRESS,
      to: "random@sample.com", // replace with a valid email for actual testing
      subject: "Test Email from Geospatial Map",
      text: "Hello! This is a test email to verify your email setup.",
    });

    console.log("Email sent successfully:", info.response);
  } catch (error) {
    console.error("Email send failed:", error);
  }
};

testEmail();
