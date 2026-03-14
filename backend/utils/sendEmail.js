const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Create a transporter using SMTP transport
    const port = parseInt(process.env.SMTP_PORT) || 587;
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    // Define email options
    const message = {
        from: `${process.env.FROM_NAME || 'Sender Pro'} <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html, // Optional HTML format
    };

    if (options.replyTo) {
        message.replyTo = options.replyTo;
    }

    // Send the email
    const info = await transporter.sendMail(message);
    console.log('Message sent: %s', info.messageId);
};

module.exports = sendEmail;
