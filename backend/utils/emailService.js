const nodemailer = require('nodemailer');

/**
 * Send verification email using Gmail SMTP
 * Gmail allows sending to any email address without domain verification
 * 
 * Setup required:
 * 1. Enable 2-Factor Authentication on your Gmail account
 * 2. Generate an App Password: https://myaccount.google.com/apppasswords
 * 3. Add GMAIL_USER and GMAIL_APP_PASSWORD to your .env file
 * 
 * Note: The "from" address will be your Gmail address. This works for
 * verification emails and doesn't require domain verification.
 */
const sendVerificationEmail = async (email, name, token) => {
  try {
    // Check if Gmail credentials are configured
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
    
    if (!gmailUser || !gmailAppPassword) {
      console.warn('⚠️  Gmail credentials not found in .env');
      console.warn('   To send real emails, please:');
      console.warn('   1. Enable 2-Factor Authentication on your Gmail account');
      console.warn('   2. Generate an App Password: https://myaccount.google.com/apppasswords');
      console.warn('   3. Add GMAIL_USER=your.email@gmail.com to backend/.env');
      console.warn('   4. Add GMAIL_APP_PASSWORD=your_app_password to backend/.env');
      console.warn('   For now, email sending is disabled.');
      return { 
        success: false, 
        error: 'Gmail credentials not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD to .env file.' 
      };
    }

    // Get base URL and create verification URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5829';
    const verificationUrl = `${baseUrl}/verify-email/${token}`;
    
    // Use Gmail SMTP via nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword
      }
    });

    const fromName = process.env.EMAIL_FROM_NAME || 'EMEDX';
    const fromAddress = `"${fromName}" <${gmailUser}>`;

    const mailOptions = {
      from: fromAddress,
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

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent successfully');
    console.log('   From:', gmailUser);
    console.log('   To:', email);
    console.log('   Message ID:', info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send OTP email (e.g. for owner login verification)
 */
const sendOtpEmail = async (email, code, name = 'User') => {
  try {
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailAppPassword) {
      console.warn('⚠️  Gmail credentials not found. OTP email not sent.');
      return { success: false, error: 'Gmail credentials not configured' };
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailAppPassword }
    });

    const fromName = process.env.EMAIL_FROM_NAME || 'EMEDX';
    const fromAddress = `"${fromName}" <${gmailUser}>`;

    const mailOptions = {
      from: fromAddress,
      to: email,
      subject: 'Your login verification code',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Verification code</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 40px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
            <tr>
              <td style="background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%); padding: 24px 30px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 600;">Verification code</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px 30px;">
                <p style="margin: 0 0 16px; font-size: 16px;">Hello ${name},</p>
                <p style="margin: 0 0 24px; font-size: 16px;">Your verification code is:</p>
                <p style="margin: 0 0 24px; font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #4a90e2;">${code}</p>
                <p style="margin: 0; font-size: 14px; color: #666;">This code expires in 10 minutes. Do not share it.</p>
              </td>
            </tr>
            <tr>
              <td style="background: #f9f9f9; padding: 16px 30px; text-align: center; font-size: 12px; color: #999;">
                © ${new Date().getFullYear()} EMEDX
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `Hello ${name},\n\nYour verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it.\n\nEMEDX`
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ OTP email sent to', email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendVerificationEmail,
  sendOtpEmail
};
