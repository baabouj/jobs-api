import nodemailer from 'nodemailer';

import config from './config';

const transport = nodemailer.createTransport(config.email.smtp);

export default transport;
