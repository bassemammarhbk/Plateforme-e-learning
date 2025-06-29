const nodemailer = require('nodemailer');

module.exports = async (email, subject, text, html) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.HOST,
            service: process.env.SERVICE,
            port: Number(process.env.EMAIL_PORT), // "post" → "port"
            secure: Boolean(process.env.SECURE),
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS // Correction de "password" → "pass"
            }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: subject,
            text: text,
            html: html // Ajout du champ HTML pour le mail
        });

        console.log("✅ Email envoyé avec succès !");
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi de l'email :", error);
    }
};
