
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Connection request email
const sendConnectionRequestEmail = async ({
  toEmail,
  toName,
  fromName,
}) => {
  try {
    const info = await transporter.sendMail({
      from: `"DevTinder" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `${fromName} sent you a connection request on DevTinder!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; background: #0a0a0a; color: white; border-radius: 12px;">
          <h1 style="color: #3b82f6; text-align: center;">DevTinder</h1>

          <h2>Hey ${toName || "there"}!</h2>

          <p>
            <strong style="color: #3b82f6;">${fromName}</strong>
            has sent you a connection request on DevTinder.
          </p>

          <p>Log in to accept or reject the request.</p>

          <a
            href="${process.env.FRONTEND_URL || "http://localhost:5173"}/requests"
            style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;"
          >
            View Request
          </a>

          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            DevTinder - Connect with developers worldwide
          </p>
        </div>
      `,
    });

    console.log(`Email sent to ${toEmail}. Message ID: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error("Connection request email failed:", err.message);
    throw err;
  }
};

// Daily pending connection requests reminder
const sendPendingRequestsEmail = async ({
  toName,
  toEmail,
  senders,
}) => {
  try {
    const senderList = senders
      .map(
        (name) =>
          `<li style="color: #3b82f6; padding: 6px 0;">${name}</li>`
      )
      .join("");

    const info = await transporter.sendMail({
      from: `"DevTinder" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `You have ${senders.length} pending connection request(s) on DevTinder!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; background: #0a0a0a; color: white; border-radius: 12px;">
          <h1 style="color: #3b82f6; text-align: center;">DevTinder</h1>

          <h2>Good morning, ${toName || "there"}!</h2>

          <p>You have <strong>${senders.length} pending connection request(s)</strong> waiting for you:</p>

          <ul style="list-style: none; padding: 0;">
            ${senderList}
          </ul>

          <p>Log in to view your pending requests.</p>

          <a
            href="${process.env.FRONTEND_URL || "http://localhost:5173"}/requests"
            style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;"
          >
            View Requests
          </a>
        </div>
      `,
    });

    console.log(`Reminder email sent to ${toEmail}. Message ID: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error("Pending requests email failed:", err.message);
    throw err;
  }
};

module.exports = {
  sendConnectionRequestEmail,
  sendPendingRequestsEmail,
};
