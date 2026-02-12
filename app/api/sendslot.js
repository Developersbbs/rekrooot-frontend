"use server";

import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  const {
    NEWUSER_SMTP_HOST,
    NEWUSER_SMTP_PORT,
    INTERVIEW_SMTP_USER,
    INTERVIEW_SMTP_PASS,
    INTERVIEW_SMTP_FROM
  } = process.env;

  const smtpHost = NEWUSER_SMTP_HOST || 'smtp.zoho.in';
  const smtpPort = Number(NEWUSER_SMTP_PORT) || 465;
  const smtpUser = INTERVIEW_SMTP_USER || 'interview@rekrooot.com';
  const smtpPass = INTERVIEW_SMTP_PASS || 'dfGNUzF99jJA';
  const smtpFrom = INTERVIEW_SMTP_FROM || smtpUser;
  const smtpSecure = true;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    return res.status(500).json({ success: false, message: 'Email service is not configured' });
  }

  const transporterConfig = {
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
  };
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const {
      type,
      candidateEmail,
      candidateName,
      recruiterEmail,
      vendorEmail,
      jobTitle,
      clientName,
      interviewerName,
      selectedTimeSlot,
      sendDirectInvitation,
      link
    } = req.body;


    if (!candidateEmail || (type !== 'cancel' && !link && !sendDirectInvitation)) {
      console.error('Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing candidate email or link/time slot'
      });
    }

    const ccList = [recruiterEmail, vendorEmail].filter(email => email).join(', ');

    const createEmailContent = () => {
      const type = req.body.type;

      if (type === 'cancel') {
        const subjectLine = `Interview Cancelled - ${candidateName} for ${jobTitle}`;
        return {
          to: candidateEmail,
          cc: ccList,
          from: smtpFrom,
          subject: subjectLine,
          html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Interview Cancelled</title><style>body{font-family:Arial,sans-serif;margin:0;padding:0;background-color:#f4f4f4}.container{background-color:#fff;margin:0 auto;padding:20px;max-width:600px;border-radius:8px;box-shadow:0 0 10px rgba(0,0,0,.1)}.header{background-color:#d32f2f;color:#fff;padding:20px;text-align:center;border-top-left-radius:8px;border-top-right-radius:8px}.header h1{margin:0;font-size:24px}.content{padding:20px;color:#333;line-height:1.6}.content p{margin:0 0 10px}.footer{text-align:center;color:#777;font-size:12px;margin-top:20px}h2{color:#333;margin-top:20px}.cancel-box{background-color:#fffef0;border-left:4px solid #d32f2f;padding:15px;margin:20px 0;border-radius:4px}</style></head><body><div class="container"><div class="header"><img width="100" src="https://firebasestorage.googleapis.com/v0/b/x-talento-new.appspot.com/o/assets%2Flogo.png?alt=media&token=0e681b04-04b6-4ebc-855e-dfcc3f9acabe" alt="rekrooot-img"><h1>Interview Cancelled</h1></div><div class="content"><h2>Dear <strong>${candidateName}</strong>,</h2><p>This is to inform you that your interview for the <strong>${jobTitle}</strong> position with <strong>${clientName}</strong> has been <strong>cancelled</strong>.</p><div class="cancel-box"><strong>Position:</strong> ${jobTitle}<br><strong>Company:</strong> ${clientName}</div><p>We apologize for any inconvenience this may have caused. If you have any questions, please contact us at <a href="mailto:hr@rekrooot.com">hr@rekrooot.com</a>.</p><p>Best regards,<br>The Rekrooot Interview Panel</p></div><div class="footer"><p> © 2024 <a href="#">Rekrooot</a> | All rights reserved.</p></div></div></body></html>`
        };
      }

      if (sendDirectInvitation) {
        // Direct interview invitation with selected time slot
        const subjectLine = `Interview Invitation - ${candidateName} for ${jobTitle}`;
        return {
          to: candidateEmail,
          cc: ccList,
          from: smtpFrom,
          subject: subjectLine,
          html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Interview Invitation</title><style>body{font-family:Arial,sans-serif;margin:0;padding:0;background-color:#f4f4f4}.container{background-color:#fff;margin:0 auto;padding:20px;max-width:600px;border-radius:8px;box-shadow:0 0 10px rgba(0,0,0,.1)}.header{background-color:#2f4858;color:#fff;padding:20px;text-align:center;border-top-left-radius:8px;border-top-right-radius:8px}.header h1{margin:0;font-size:24px}.content{padding:20px;color:#333;line-height:1.6}.content p{margin:0 0 10px}.button{text-align:center;margin:20px 0}.button a{background-color:#2f4858;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-size:16px}.button a:hover{color:#2f4858;background-color:#fb8404}.footer{text-align:center;color:#777;font-size:12px;margin-top:20px}h2{color:#333;margin-top:20px}ul{margin:10px 0;padding-left:20px}li{margin-bottom:5px}.highlight-box{background-color:#f0f9ff;border-left:4px solid:#2f4858;padding:15px;margin:20px 0;border-radius:4px}</style></head><body><div class="container"><div class="header"><img width="100" src="https://firebasestorage.googleapis.com/v0/b/x-talento-new.appspot.com/o/assets%2Flogo.png?alt=media&token=0e681b04-04b6-4ebc-855e-dfcc3f9acabe" alt="rekrooot-img"><h1>Interview Invitation</h1></div><div class="content"><h2>Dear <strong>${candidateName}</strong>,</h2><p>We hope you're doing great! We're thrilled to let you know that you've been <strong>shortlisted</strong> for the <strong>${jobTitle}</strong> position with <strong>${clientName}</strong>. You've made it to this important step in the hiring process—<strong>congratulations</strong> on your achievement!</p><p>We are pleased to inform you that your interview has been <strong>scheduled</strong> for the following time:</p><div class="highlight-box"><strong>Interview Time:</strong> ${selectedTimeSlot}<br><strong>Interviewer:</strong> ${interviewerName || 'Interviewer'}</div>${link ? `<p>Please join the interview using the link below at the scheduled time:</p><div class="button"><a href="${link}" target="_blank">Join Interview</a></div>` : ''}<h2>Interview Guidelines</h2><ul><li>Make sure you have a <strong>laptop with a working camera</strong>.</li><li>Set up in a <strong>well-lit</strong> space for clear visibility.</li><li><strong>Share your desktop</strong> during the interview and avoid external assistance.</li><li>Close all background applications; using <strong>remote connections</strong> or dual monitors is not allowed.</li><li>Ensure you have a <strong>strong internet connection</strong> and a webcam.</li><li>The interview will be <strong>recorded</strong> and will include coding and theoretical questions.</li><li>Please connect using a <strong>laptop or desktop</strong>—handheld devices aren't allowed.</li></ul><h2>Identification Verification</h2><p>As part of our process, we'll require a quick <strong>photo ID verification</strong> during the interview.</p><p>If you have any questions or need clarification before the interview, feel free to reach out to us at <a href="mailto:hr@rekrooot.com">hr@rekrooot.com</a>.</p><p>We're looking forward to seeing you in the interview. Best of luck in your preparations—we know you'll do great!</p><p>Best regards,<br>The Rekrooot Interview Panel</p></div><div class="footer"><p> 2024 <a href="#">Rekrooot</a> | All rights reserved.</p></div></div></body></html>`
        };
      } else {
        // Original scheduling link email
        const subjectLine = `Interview Scheduling - ${candidateName} for ${jobTitle} at ${clientName}`;
        return {
          to: candidateEmail,
          cc: ccList,
          from: smtpFrom,
          subject: subjectLine,
          html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email Invitation</title><style>body{font-family:Arial,sans-serif;margin:0;padding:0;background-color:#f4f4f4}.container{background-color:#fff;margin:0 auto;padding:20px;max-width:600px;border-radius:8px;box-shadow:0 0 10px rgba(0,0,0,.1)}.header{background-color:#2f4858;color:#fff;padding:20px;text-align:center;border-top-left-radius:8px;border-top-right-radius:8px}.header h1{margin:0;font-size:24px}.content{padding:20px;color:#333;line-height:1.6}.content p{margin:0 0 10px}.button{text-align:center;margin:20px 0}.button a{background-color:#2f4858;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;font-size:16px}.button a:hover{color:#2f4858;background-color:#fb8404}.footer{text-align:center;color:#777;font-size:12px;margin-top:20px}h2{color:#333;margin-top:20px}ul{margin:10px 0;padding-left:20px}li{margin-bottom:5px}</style></head><body><div class="container"><div class="header"><img width="100" src="https://firebasestorage.googleapis.com/v0/b/x-talento-new.appspot.com/o/assets%2Flogo.png?alt=media&token=0e681b04-04b6-4ebc-855e-dfcc3f9acabe" alt="rekrooot-img"><h1>Interview Invitation</h1></div><div class="content"><h2>Dear <strong>${candidateName}</strong>,</h2><p>We hope you're doing great! We're thrilled to let you know that you've been <strong>shortlisted</strong> for the <strong>L1 Technical Interview</strong> with <strong>Rekrooot</strong> on behalf of <strong>${clientName}</strong>. You've made it to this important step in the hiring process—<strong>congratulations</strong> on your achievement!</p><p>Please select your preferred interview time slot using the link below:</p><div class="button"><a href="${link}" target="_blank">Select Your Interview Timeslot</a></div><h2>Interview Guidelines</h2><ul><li>Make sure you have a <strong>laptop with a working camera</strong>.</li><li>Set up in a <strong>well-lit</strong> space for clear visibility.</li><li><strong>Share your desktop</strong> during the interview and avoid external assistance.</li><li>Close all background applications; using <strong>remote connections</strong> or dual monitors is not allowed.</li><li>Ensure you have a <strong>strong internet connection</strong> and a webcam.</li><li>The interview will be <strong>recorded</strong> and will include coding and theoretical questions.</li><li>Please connect using a <strong>laptop or desktop</strong>—handheld devices aren't allowed.</li></ul><h2>Identification Verification</h2><p>As part of our process, we'll require a quick <strong>photo ID verification</strong> during the interview.</p><p>Once you've chosen your time slot, you'll receive an official interview invite with all the necessary details, including the link to join the session.</p><p>If you have any questions or need clarification before the interview, feel free to reach out to us at <a href="mailto:hr@rekrooot.com">hr@rekrooot.com</a>.</p><p>We're looking forward to seeing you in the L1 Technical Interview. Best of luck in your preparations—we know you'll do great!</p><p>Best regards,<br>The Rekrooot Interview Panel</p></div><div class="footer"><p> 2024 <a href="#">Rekrooot</a> | All rights reserved.</p></div></div></body></html>`
        };
      }
    };

    const transporter = nodemailer.createTransport(transporterConfig);

    await transporter.verify();

    try {
      const emailContent = createEmailContent();
      const info = await transporter.sendMail(emailContent);

      console.log('SMTP Response:', info);

      return res.status(200).json({
        success: true,
        message: 'Email sent successfully',
        details: {
          messageId: info.messageId,
          accepted: info.accepted,
          cc: ccList
        }
      });
    } catch (sendError) {
      console.error('SMTP Send Error:', sendError);
      throw sendError;
    }

  } catch (error) {
    console.error('SMTP Error:', error);

    const errorMessage = error.response?.body?.errors?.[0]?.message || error.message;

    return res.status(500).json({
      success: false,
      message: 'Failed to send emails',
      error: errorMessage,
      details: error.response?.body || error
    });
  }
}
