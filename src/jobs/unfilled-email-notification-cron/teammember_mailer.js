const moment = require('moment');
const { logger } = require('winston');
const Mailer = require('./mailer');

class TeamMemberMailer extends Mailer {
  async sendEmail() {
    const previousMonthName = moment().subtract(1, 'months').format('MMMM');
    const dataFromDb = await this.unfilledTimesheetEmails();

    const allEmailsToSend = dataFromDb.reduce((emails, currentObj) => {
      if (!emails.find((e) => e.email === currentObj.Email)) {
        emails.push({ email: currentObj.Email });
      }

      return emails;
    }, []);

    const subject = `Timesheet Reminder for ${previousMonthName}`;
    for (const { email } of allEmailsToSend) {
      const htmlContent = await this.prepareEmailHtml({ email, month: previousMonthName });
      await this.sendEmailWithErrorCatch({ to: email, subject, html: htmlContent });
    }
  }

  async prepareEmailHtml({ email, month }) {
    try {
      let htmlContent = await this.readFile('./teammember_email_template.html');
      htmlContent = htmlContent.replace('{email}', email).replace('{month}', month);
      return htmlContent;
    } catch (error) {
      logger.error('Error in preparing timesheet HTML for teammember ', error);
    }
  }
}

module.exports = TeamMemberMailer;
module.exports.teamMemberMailer = new TeamMemberMailer();
