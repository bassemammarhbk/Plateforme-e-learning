const express = require('express');
const router = express.Router();
const Newsletter = require('../models/newsletter');
const nodemailer = require('nodemailer');

// Transporter Nodemailer (exemple avec Gmail, remplace-le par un service pro en prod)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // ex: tonmail@gmail.com
    pass: process.env.EMAIL_PASS  // mot de passe ou App Password
  }
});

router.post('/subscribe', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

  try {
    // Vérifier si déjà abonné
    if (await Newsletter.findOne({ email })) {
      return res.status(409).json({ success: false, message: 'Vous êtes déjà abonné·e !' });
    }
    await new Newsletter({ email }).save();

    // Construction du lien de désabonnement
    const unsubscribeUrl = `${req.protocol}://${req.get('host')}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;

    // Email de confirmation d'abonnement
    const html = `
      <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:8px; overflow:hidden;">
        <div style="background-color:#0047ba; padding:20px; text-align:center;">
          <h1 style="color:#ffffff; margin:0; font-size:24px;">Bienvenue dans la Newsletter Learnista</h1>
        </div>
        <div style="background-color:#f9f9f9; padding:30px; color:#333333;">
          <p style="font-size:18px;">Bonjour,</p>
          <p style="font-size:16px; line-height:1.5;">
            Merci de vous être abonné·e à notre newsletter !
            Vous recevrez dans votre boite email les dernières nouveautés, cours, et ressources pédagogiques de Learnista.
          </p>
        </div>
        <div style="background-color:#eeeeee; padding:15px; text-align:center; font-size:12px; color:#777777;">
          © ${new Date().getFullYear()} Learnista - Tous droits réservés
        </div>
      </div>`;

    await transporter.sendMail({
      from: `"Learnista Newsletter" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Votre abonnement à la Newsletter Learnista',
      html
    });

    return res.status(201).json({ success: true, message: 'Inscription réussie. Vérifiez votre e-mail !' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});


router.get('/unsubscribe', async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email requis pour désabonnement" });
  }
  try {
    const result = await Newsletter.findOneAndDelete({ email });
    if (!result) {
      return res.status(404).json({ success: false, message: "Email non trouvé dans la liste des abonnés" });
    }

    // Confirmation désabonnement
    await transporter.sendMail({
      from: `"Learnista Newsletter" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Vous êtes désabonné·e",
      html: `
        <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto;">
          <div style="background-color:#0047ba; padding:20px; text-align:center;">
            <h2 style="color:#ffffff; margin:0;">Désabonnement confirmé</h2>
          </div>
          <div style="background-color:#f9f9f9; padding:30px; color:#333;">
            <p style="font-size:16px;">Vous avez été désabonné·e avec succès de notre newsletter.</p>
            <p style="font-size:14px;">Nous sommes désolés de vous voir partir.</p>
          </div>
          <div style="background-color:#eeeeee; padding:15px; text-align:center; font-size:12px; color:#777;">
            © ${new Date().getFullYear()} Learnista
          </div>
        </div>`
    });

    return res.status(200).json({ success: true, message: "Désabonnement réussi." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// GET /newsletter-subscribers - liste de tous les abonnés
router.get('/newsletter-subscribers', async (req, res) => {
  try {
    const subscribers = await Newsletter.find().select('email -_id');
    res.status(200).json(subscribers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
});


module.exports = router;
