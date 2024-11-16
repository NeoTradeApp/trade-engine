const nodemailer = require('nodemailer');
const moment = require('moment');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('winston');

const { MAILER_EMAIL_ID, MAILER_PASSWORD, MAILER_DEBUG_EMAIL, MAILER_DEBUG_EMAIL_COUNT } = process.env;

class Mailer {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'mail.creatingwow.in',
      port: 465,
      secure: true,
      auth: { user: MAILER_EMAIL_ID, pass: MAILER_PASSWORD },
    });

    const toEmails = (MAILER_DEBUG_EMAIL || '').length && MAILER_DEBUG_EMAIL.split(',');
    this.mailOptions = {
      from: 'no-reply@infobeans.com',
      to: toEmails || [],
      text: '',
      subject: '',
    };

    this.debugEmailSent = 0;
  }

  async unfilledTimesheetEmails() {
    const { TsProject } = require('../../models');
    const previousDate = moment().subtract(1, 'months').format('YYYY-MM-DD');

    return await TsProject.findUnfilledTimesheetEmails(previousDate);
  }

  async sendEmailWithErrorCatch(options) {
    try {
      if ((MAILER_DEBUG_EMAIL || '').length) options.to = this.mailOptions.to;

      const mailerDebugEmailCount = parseInt(MAILER_DEBUG_EMAIL_COUNT);
      if (mailerDebugEmailCount > 0) {
        this.debugEmailSent += 1;
        if (this.debugEmailSent > mailerDebugEmailCount) return;
      }

      const responseInfo = await this.transporter.sendMail({ ...this.mailOptions, ...options });
      logger.info('Email sent: ' + responseInfo.response);
    } catch (error) {
      logger.error('Error in sending email: ', error);
    }
  }

  async readFile(filePath) {
    return await fs.readFile(path.resolve(__dirname, filePath), 'utf8');
  }
}

module.exports = Mailer;
module.exports.mailer = new Mailer();
