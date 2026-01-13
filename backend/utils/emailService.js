const nodemailer = require('nodemailer');

// Create transporter for Outlook/SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp-mail.outlook.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      ciphers: 'SSLv3'
    }
  });
};

// Send verification email
const sendVerificationEmail = async (email, name, token) => {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('Email credentials not configured. Skipping email send.');
      return { success: false, error: 'Email service not configured' };
    }

    const transporter = createTransporter();
    
    // Get base URL from environment or use default
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5829';
    const verificationUrl = `${baseUrl}/#/verify-email/${token}`;
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'EMEDX'}" <service@mdecx.com>`,
      to: email,
      subject: 'Verify your email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your email</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333333; background-color: #f5f5f5; margin: 0; padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%); padding: 40px 30px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Email Verification</h1>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">Hello ${name},</p>
                      <p style="margin: 0 0 30px 0; font-size: 16px; color: #333333; line-height: 1.6;">
                        Thank you for registering with EMEDX! To complete your registration and activate your account, please verify your email address by clicking the button below:
                      </p>
                      <!-- Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 30px 0;">
                            <a href="${verificationUrl}" 
                               style="display: inline-block; background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3);">
                              Verify Email Address
                            </a>
                          </td>
                        </tr>
                      </table>
                      <!-- Alternative Link -->
                      <p style="margin: 30px 0 15px 0; font-size: 14px; color: #666666;">
                        If the button doesn't work, you can copy and paste the following link into your browser:
                      </p>
                      <p style="margin: 0 0 30px 0; padding: 12px; background-color: #f9f9f9; border-radius: 4px; word-break: break-all; font-size: 13px; color: #4a90e2; font-family: monospace;">
                        ${verificationUrl}
                      </p>
                      <!-- Footer Note -->
                      <p style="margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 13px; color: #999999; line-height: 1.5;">
                        This verification link will expire in 24 hours. If you didn't create an account with EMEDX, please ignore this email.
                      </p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e5e5;">
                      <p style="margin: 0; font-size: 12px; color: #999999;">
                        © ${new Date().getFullYear()} EMEDX. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
Hello ${name},

Thank you for registering with EMEDX! To complete your registration and activate your account, please verify your email address by clicking the link below:

${verificationUrl}

This verification link will expire in 24 hours.

If the link doesn't work, copy and paste it into your browser's address bar.

If you didn't create an account with EMEDX, please ignore this email.

Best regards,
EMEDX Team
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendVerificationEmail
};
