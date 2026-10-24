
const cron = require("node-cron");
const ConnectionRequest = require("../models/connectionRequest");
const { sendPendingRequestsEmail } = require("./sendEmail");

const startScheduler = () => {
  // Runs daily at 8:00 AM Indian Standard Time
  cron.schedule(
    "0 8 * * *",
    async () => {
      console.log("Running daily pending connection requests email job...");

      try {
        const pendingRequests = await ConnectionRequest.find({
          status: "interested",
          emailSent: false,
        })
          .populate("fromUserId", "firstName")
          .populate("toUserId", "firstName emailId");

        const grouped = {};

        pendingRequests.forEach((request) => {
          if (!request.fromUserId || !request.toUserId) return;

          const email = request.toUserId.emailId;

          if (!email) return;

          if (!grouped[email]) {
            grouped[email] = {
              toName: request.toUserId.firstName,
              toEmail: email,
              senders: [],
              requestIds: [],
            };
          }

          grouped[email].senders.push(request.fromUserId.firstName);
          grouped[email].requestIds.push(request._id);
        });

        for (const email of Object.keys(grouped)) {
          const { toName, toEmail, senders, requestIds } = grouped[email];

          // Mark requests as emailed only after successful sending
          await sendPendingRequestsEmail({
            toName,
            toEmail,
            senders,
          });

          await ConnectionRequest.updateMany(
            {
              _id: { $in: requestIds },
              emailSent: false,
            },
            {
              $set: { emailSent: true },
            }
          );

          console.log(`Reminder email sent to ${toEmail}`);
        }

        if (Object.keys(grouped).length === 0) {
          console.log("No pending requests to email today.");
        }
      } catch (error) {
        console.error("Scheduler error:", error.message);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log("Email scheduler registered: daily at 8:00 AM IST.");
};

module.exports = { startScheduler };
