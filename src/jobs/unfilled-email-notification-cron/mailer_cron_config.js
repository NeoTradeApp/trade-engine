const cron = require('node-cron');
const { logger } = require('winston');
const { duHeadMailer } = require('./du_head_mailer');
const { teamMemberMailer } = require('./teammember_mailer');
const { MAILER_DU_SCHEDULE_TIME, MAILER_TEAMMEMBER_SCHEDULE_TIME } = process.env;

class MailerCronConfig {
  constructor() {
    this.options = { scheduled: true, timezone: 'Asia/Kolkata' };
  }

  scheduleDUEmailNotification() {
    this.duEmailNotificationnTask = cron.schedule(MAILER_DU_SCHEDULE_TIME, () => {
      logger.info('-- Cron job at 0 7 17,18,19 * * for the DU email notificaiton --');
      duHeadMailer.sendEmail();
    }, this.options);

    return this.duEmailNotificationnTask;
  }

  scheduleTeammemberEmailNotification() {
    this.teammemberEmailNotificationnTask = cron.schedule(MAILER_TEAMMEMBER_SCHEDULE_TIME, () => {
      logger.info('-- Cron job at 0 8 17,18,19 * * for the team member email notificaiton --');
      teamMemberMailer.sendEmail();
    }, this.options);

    return this.teammemberEmailNotificationnTask;
  }

  stopAll() {
    this.duEmailNotificationnTask.stop();
    this.teammemberEmailNotificationnTask.stop();
  }

  setup() {
    this.scheduleDUEmailNotification();
    this.scheduleTeammemberEmailNotification();
  }
}

module.exports = MailerCronConfig;
module.exports.mailerCronConfig = new MailerCronConfig();
