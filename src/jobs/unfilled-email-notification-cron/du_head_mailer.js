const moment = require('moment');
const { logger } = require('winston');
const Mailer = require('./mailer');

class DuHeadMailer extends Mailer {
  async sendEmail() {
    const previousMonthName = moment().subtract(1, 'months').format('MMMM');
    const dataFromDb = await this.unfilledTimesheetEmails();

    const allEmailsToSend = dataFromDb.reduce((total, currentObj) => {
      const { [currentObj.DuHead]: emails = [] } = total;
      emails.push({ email: currentObj.Email });
      return { ...total, [currentObj.DuHead]: emails };
    }, {});

    const subject = 'Action Required: Your Team Pending Timesheets';
    for (const [duHead, emails] of Object.entries(allEmailsToSend)) {
      const htmlContent = await this.prepareEmailHtml({ duHead, emails, month: previousMonthName });
      await this.sendEmailWithErrorCatch({ to: duHead, subject, html: htmlContent });
    }
  }

  async prepareEmailHtml({ duHead, emails, month }) {
    try {
      let htmlContent = await this.readFile('./du_head_email_template.html');
      let tableData = emails.map((data, index) => `<tr><td>${index + 1}</td><td>${data.email}</td></tr>`);
      tableData = tableData.toString().replace(/,/g, '');

      htmlContent = htmlContent.replace('{duHead}', duHead)
        .replace('{emails}', tableData)
        .replace('{month}', month);
      return htmlContent;
    } catch (error) {
      logger.error('Error in preparing timesheet HTML for du head ', error);
    }
  }
}

module.exports = DuHeadMailer;
module.exports.duHeadMailer = new DuHeadMailer();
