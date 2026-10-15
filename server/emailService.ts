import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    // Check if email credentials are provided
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('Email service not configured. Email notifications will be disabled.');
      return;
    }

    const config: EmailConfig = {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };

    this.transporter = nodemailer.createTransport(config);
    console.log('Email service initialized successfully');
  }

  async sendApprovalNotification(userEmail: string, userName: string): Promise<boolean> {
    if (!this.transporter) {
      console.log('Email service not configured, skipping notification');
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: userEmail,
        subject: 'Account Approved - SaHa Carbon Footprint Tracker',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #059669; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">SaHa Carbon Footprint Tracker</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f9f9f9;">
              <h2 style="color: #374151;">Account Approved!</h2>
              
              <p>Hello ${userName},</p>
              
              <p>Great news! Your account for the SaHa Carbon Footprint Tracker has been approved by our administrator.</p>
              
              <p>You can now access all features of the platform including:</p>
              <ul style="color: #6b7280;">
                <li>Creating and managing construction projects</li>
                <li>Tracking carbon footprint with real emission factors</li>
                <li>Accessing comprehensive material catalogs</li>
                <li>Generating detailed environmental reports</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.BASE_URL || 'https://saha-tracker.replit.app'}" 
                   style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Access Your Account
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">
                If you have any questions or need assistance, please contact your system administrator.
              </p>
            </div>
            
            <div style="background-color: #e5e7eb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>This is an automated message from SaHa Carbon Footprint Tracker</p>
            </div>
          </div>
        `,
        text: `
          Account Approved - SaHa Carbon Footprint Tracker
          
          Hello ${userName},
          
          Your account for the SaHa Carbon Footprint Tracker has been approved!
          
          You can now access the platform at: ${process.env.BASE_URL || 'https://saha-tracker.replit.app'}
          
          Features available to you:
          - Creating and managing construction projects
          - Tracking carbon footprint with real emission factors
          - Accessing comprehensive material catalogs
          - Generating detailed environmental reports
          
          If you have any questions, please contact your system administrator.
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Approval notification sent to ${userEmail}`);
      return true;
    } catch (error) {
      console.error('Failed to send approval notification:', error);
      return false;
    }
  }

  async sendRejectionNotification(userEmail: string, userName: string): Promise<boolean> {
    if (!this.transporter) {
      console.log('Email service not configured, skipping notification');
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: userEmail,
        subject: 'Account Application Update - SaHa Carbon Footprint Tracker',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #dc2626; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">SaHa Carbon Footprint Tracker</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f9f9f9;">
              <h2 style="color: #374151;">Account Application Update</h2>
              
              <p>Hello ${userName},</p>
              
              <p>Thank you for your interest in the SaHa Carbon Footprint Tracker platform.</p>
              
              <p>After review, we are unable to approve your account at this time. This may be due to:</p>
              <ul style="color: #6b7280;">
                <li>Incomplete application information</li>
                <li>Current platform capacity limitations</li>
                <li>Specific organizational requirements</li>
              </ul>
              
              <p style="color: #6b7280; font-size: 14px;">
                If you believe this was an error or would like to discuss your application, please contact your system administrator for further assistance.
              </p>
            </div>
            
            <div style="background-color: #e5e7eb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
              <p>This is an automated message from SaHa Carbon Footprint Tracker</p>
            </div>
          </div>
        `,
        text: `
          Account Application Update - SaHa Carbon Footprint Tracker
          
          Hello ${userName},
          
          Thank you for your interest in the SaHa Carbon Footprint Tracker platform.
          
          After review, we are unable to approve your account at this time.
          
          If you believe this was an error or would like to discuss your application, please contact your system administrator.
        `
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Rejection notification sent to ${userEmail}`);
      return true;
    } catch (error) {
      console.error('Failed to send rejection notification:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();