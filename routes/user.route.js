const express = require('express');
const router = express.Router();
const User = require("../models/user");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();
const nodemailer = require('nodemailer');
const Etudiant = require('../models/etudiant');
const Enseignant = require('../models/enseignant');
const { verifyToken } = require('../middlwares/verifToken');
const { authorizeRoles } = require('../middlwares/authorizeRoles');
const Certificat = require('../models/certificat');
const crypto = require('crypto');



// Nodemailer setup
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Register
// Register route
router.post('/register', async (req, res) => {
    try {
        let { email, password, firstname, lastname, avatar, role, tel, sexe, specialite } = req.body;

        // Vérifier si l'email est déjà utilisé
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send({ success: false, message: "Cette adresse email est déjà enregistrée." });
        }

        // Générer un token d'activation unique et une expiration (24h)
        const token = crypto.randomBytes(32).toString('hex');
        const expiration = Date.now() + 24 * 60 * 60 * 1000; // 24 heures

        // Créer un nouvel utilisateur
        const newUser = new User({
            email,
            password,
            firstname,
            lastname,
            avatar,
            role,
            tel,
            sexe,
            isActive: false,
            activationToken: token,
            activationTokenExpires: expiration
        });
        const createdUser = await newUser.save();

        // Créer un profil en fonction du rôle
        if (role === 'etudiant') {
            const newEtudiant = new Etudiant({
                userId: createdUser._id,
                coursInscri: [],
                certifications: [],
                points: 0
            });
            await newEtudiant.save();
        } else if (role === 'enseignant') {
            const newEnseignant = new Enseignant({
                userId: createdUser._id,
                specialite: specialite || '',
                tel: tel || ''
            });
            await newEnseignant.save();
        }

        // Lien d’activation sécurisé par token
        const activationLink = `http://${req.headers.host}/api/users/status/edit?token=${token}`;

        // Contenu HTML du mail d’activation
        const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0047ba; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Bienvenue sur Learnista</h1>
          </div>
          <div style="background-color: #f9f9f9; padding: 30px; color: #333;">
            <p style="font-size: 18px;">Bonjour <strong>${newUser.firstname}</strong>,</p>
            <p style="font-size: 16px; line-height: 1.5;">
              Merci de vous être inscrit·e sur notre plateforme. Pour activer votre compte, veuillez cliquer sur le bouton ci-dessous dans les prochaines 24 heures :
            </p>
            <p style="text-align: center; margin: 40px 0;">
              <a href="${activationLink}"
                 style="background-color: #0047ba; color: white; padding: 15px 35px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                Activer mon compte
              </a>
            </p>
          </div>
          <table role="presentation" width="100%" style="background-color: #eee; padding: 15px; font-size: 12px; color: #777; text-align: center; border-top: 1px solid #ddd;">
            <tr>
              <td>
                Besoin d’aide ? Contactez-nous à <a href="mailto:help@learnista.com" style="color: #0047ba; text-decoration: none;">help@learnista.com</a><br/>
                © 2025 Learnista. Tous droits réservés.
              </td>
            </tr>
          </table>
        </div>
        `;

        // Envoi du mail
        const mailOptions = {
            from: `"Learnista" <${process.env.EMAIL_USER}>`,
            to: newUser.email,
            subject: 'Activation de votre compte Learnista',
            html
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Erreur lors de l’envoi de l’email :', error);
            } else {
                console.log('Email envoyé à :', newUser.email);
            }
        });

        return res.status(201).send({
            success: true,
            message: "Inscription réussie. Veuillez vérifier votre email pour activer votre compte.",
            user: createdUser
        });

    } catch (err) {
        console.error(err);
        return res.status(500).send({ success: false, message: "Erreur lors de l’inscription" });
    }
});



// Login
router.post('/login', async (req, res) => {
    try {
        let { email, password } = req.body;
        if (!email || !password) {
            return res.status(404).send({ success: false, message: 'Tous les champs sont obligatoires' });
        }
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(404).send({ success: false, message: 'Le compte n\'existe pas !' });
        }
        let isCorrectedPassword = await bcrypt.compare(password, user.password);
        if (isCorrectedPassword) {
            delete user._doc.password;
            if (!user.isActive) return res.status(404).send({ success: false, message: 'Votre compte est désactivé. Veuillez vérifier l’email d’activation ou contacter un administrateur pour plus d’informations.' });
            const token = jwt.sign({ iduser: user._id, name: user.firstname, role: user.role }, process.env.SECRET, { expiresIn: "1h" });
            return res.status(200).send({ success: true, user, token });
        } else {
            return res.status(404).send({ success: false, message: "E-mail ou mot de passe incorrect" });
        }
    } catch (err) {
        return res.status(404).send({ success: false, message: err.message });
    }
});

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await User.find().select("-password");
        res.status(200).json(users);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// Delete a user
router.delete('/:userId', async (req, res) => {
  try {
    const { userId: id } = req.params;

    // 1. Suppression de l'utilisateur
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // 2. Suppression du document Etudiant lié (s’il existe)
    const etuDeleted = await Etudiant.findOneAndDelete({ userId: id });

    // 3. Suppression du document Enseignant lié (s’il existe)
    const ensDeleted = await Enseignant.findOneAndDelete({ userId: id });

    // 4. Préparer le message de retour en fonction de ce qui a été supprimé
    let detailMessage;
    if (etuDeleted && ensDeleted) {
      detailMessage = "Étudiant et Enseignant supprimés.";
    } else if (etuDeleted) {
      detailMessage = "Étudiant supprimé.";
    } else if (ensDeleted) {
      detailMessage = "Enseignant supprimé.";
    } else {
      detailMessage = "Aucun document Étudiant ou Enseignant trouvé pour cet utilisateur.";
    }

    return res
      .status(200)
      .json({ message: "Utilisateur supprimé avec succès.", details: detailMessage });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Erreur serveur lors de la suppression", error: error.message });
  }
});

// Update a user
router.put('/:userId', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { $set: req.body },
            { new: true }
        );
        res.status(200).json(user);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

// Activate/Deactivate account
// Activate/Deactivate account and show success page
router.get('/status/edit', async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).send('Token manquant');

        // Chercher l'utilisateur avec token valide
        const user = await User.findOne({
            activationToken: token,
            activationTokenExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).send(`
                <h2>Lien invalide ou expiré.</h2>
                <p>Veuillez vous réinscrire ou demander un nouveau lien d’activation.</p>
            `);
        }

        user.isActive = true;
        user.activationToken = undefined;
        user.activationTokenExpires = undefined;
        await user.save();

        return res.send(`
          <!DOCTYPE html>
          <html lang="fr">
          <head>
            <meta charset="UTF-8" />
            <title>Compte activé</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                background-color: #f0f4ff;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
              }
              .container {
                background: white;
                padding: 40px 60px;
                border-radius: 10px;
                box-shadow: 0 0 15px rgba(0,0,100,0.2);
                text-align: center;
                max-width: 400px;
              }
              h1 { color: #0047ba; margin-bottom: 20px; }
              p { font-size: 18px; color: #333; }
              a {
                display: inline-block;
                margin-top: 25px;
                padding: 12px 25px;
                background-color: #0047ba;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                transition: background-color 0.3s ease;
              }
              a:hover { background-color: #003399; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Compte activé avec succès ! 🎉</h1>
              <p>Merci, ${user.firstname}, votre compte est maintenant actif.</p>
              <a href="http://localhost:3000/login">Se connecter</a>
            </div>
          </body>
          </html>
        `);
    } catch (err) {
        console.error('Erreur activation:', err);
        return res.status(500).send('Erreur serveur');
    }
});


// Get all students
router.get('/etudiants', async (req, res) => {
    try {
        const etudiants = await Etudiant.find()
            .populate('userId', 'firstname lastname email avatar tel sexe isActive')
            .populate('coursInscri', 'nomcours')
            .populate('certifications', 'nomcertificat');
        if (!etudiants || etudiants.length === 0) {
            return res.status(404).json({ message: 'Aucun étudiant trouvé' });
        }
        res.status(200).json(etudiants);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/etudiants/:userId', async (req, res) => {
    try {
        // Récupération de l'étudiant avec population des données associées
        const etudiant = await Etudiant.findOne({ userId: req.params.userId })
            .populate('userId', 'firstname lastname email avatar tel sexe') // Population des infos utilisateur
            .populate({
                path: 'coursInscri', // Population des cours inscrits
                populate: [
                    {
                        path: 'sousFiliereId', // Population des sous-filières
                        select: 'nomSousFiliere',
                        populate: {
                            path: 'filiereId', // Population des filières associées
                            select: 'nomfiliere'
                        }
                    },
                    {
                        path: 'enseignantId', // Population des enseignants (optionnel)
                        select: 'firstname lastname'
                    }
                ]
            })
            .populate('certifications', 'nomcertificat dateObtention'); // Population des certifications

        // Vérification si l'étudiant existe
        if (!etudiant) {
            return res.status(404).json({ message: 'Étudiant non trouvé' });
        }

        // Log pour déboguer et vérifier les données renvoyées
        console.log('Données de l\'étudiant :', JSON.stringify(etudiant, null, 2));

        // Réponse avec les données de l'étudiant
        res.status(200).json(etudiant);
    } catch (error) {
        // Gestion des erreurs
        console.error('Erreur lors de la récupération de l\'étudiant :', error);
        res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
});
// Enroll in a course
router.post('/enroll/:coursId', async (req, res) => {
  try {
    const { coursId } = req.params;
    const { userId } = req.body;

    // Trouver l'étudiant
    const etudiant = await Etudiant.findOne({ userId });
    if (!etudiant) {
      return res.status(404).json({ message: "Étudiant non trouvé" });
    }

    // Vérifier si le cours est déjà dans coursInscri
    if (etudiant.coursInscri.includes(coursId)) {
      return res.status(400).json({ message: "Vous êtes déjà inscrit à ce cours" });
    }

    // Ajouter le cours et sauvegarder
    etudiant.coursInscri.push(coursId);
    await etudiant.save();

    res.status(200).json({ message: "Inscription réussie", coursInscri: etudiant.coursInscri });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
// POST /api/etudiant/:etudiantId/complete-chapitre
router.post(
    '/:userId/complete-chapitre',
    verifyToken,
    authorizeRoles('etudiant'),
    async (req, res) => {
      try {
        const { userId }   = req.params;
        const { coursId, chapitreId } = req.body;
        let etu = await Etudiant.findOne({ userId });
        if (!etu) etu = new Etudiant({ userId });
        const deja = etu.chapitresCompletes.some(c =>
            c.coursId && c.chapitreId &&
            c.coursId.equals(coursId) &&
            c.chapitreId.equals(chapitreId)
          );

        if (deja) return res.status(200).json({ message: 'Déjà complété' });
        etu.chapitresCompletes.push({ coursId, chapitreId });
        await etu.save();
        res.status(200).json({ message: 'Chapitre complété !' });
      } catch (err) {
        console.error('🔥 complete-chapitre error:', err);
        res.status(500).json({ message: err.message, stack: err.stack });
      }
    }
  );
  // (Optionnel) GET /api/users/:userId/chapitres-completes
  router.get(
    '/:userId/chapitres-completes',
    verifyToken,
    authorizeRoles('etudiant'),
    async (req, res) => {
      try {
        const etu = await Etudiant.findOne({ userId: req.params.userId });
        const data = (etu?.chapitresCompletes || []).map(({ coursId, chapitreId }) => ({
            coursId: coursId ? coursId.toString() : null,
            chapitreId: chapitreId ? chapitreId.toString() : null,
          }));

        res.status(200).json(data);
      } catch (err) {
        console.error('get-chap-completes error:', err);
        res.status(500).json({ message: err.message });
      }
    }
  );
  router.get('/enseignants', async (req, res) => {
  try {
    const enseignants = await Enseignant.find()
      .populate('userId', 'firstname lastname email avatar tel sexe isActive')
      // si vous avez d'autres champs à peupler (cours, etc.), ajoutez-les ici
      ;
    if (!enseignants || enseignants.length === 0) {
      return res.status(404).json({ message: 'Aucun enseignant trouvé' });
    }
    return res.status(200).json(enseignants);
  } catch (error) {
    console.error('Erreur get enseignants :', error);
    return res.status(500).json({ message: error.message });
  }
});
// GET /api/users/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    // On récupère tous les étudiants triés par points décroissants
    const classement = await Etudiant.find()
      .sort({ points: -1 })
      .populate('userId', 'firstname lastname avatar')
      .limit(50); // facultatif : limiter au top 50
    res.status(200).json(classement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Get one teacher by userId
router.get('/enseignants/:userId',verifyToken, async (req, res) => {
  try {
    const enseignant = await Enseignant.findOne({ userId: req.params.userId })
      .populate('userId', 'firstname lastname email avatar tel sexe isActive ')
      // si l’enseignant a des références vers d’autres collections (cours, etc.), on peut les peupler ici
      ;
    if (!enseignant) {
      return res.status(404).json({ message: 'Enseignant non trouvé' });
    }
    return res.status(200).json(enseignant);
  } catch (error) {
    console.error('Erreur get enseignant :', error);
    return res.status(500).json({ message: error.message });
  }
});
router.put('/:userId/status',verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).send({ success: false, message: 'Utilisateur non trouvé' });
    user.isActive = !user.isActive;
    await user.save();
    return res.status(200).send({ success: true, message: 'Statut mis à jour', user });
  } catch (err) {
    console.error('Erreur mise à jour statut :', err);
    return res.status(500).send({ success: false, message: 'Erreur serveur' });
  }
});
router.get('/etudiants/:id', async (req, res) => {
    try {
        const etudiant = await Etudiant.findById(req.params.id).populate('coursInscrits');
        if (!etudiant) {
            return res.status(404).json({ message: "Étudiant non trouvé" });
        }
        res.status(200).json(etudiant);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur" });
    }
});
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).send({ success:false, message: "Email introuvable" });
  }

  // Générer le token
  const token = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = token;
  user.resetPasswordExpires = Date.now() + 3600000; // 1h
  await user.save();

  // Préparer l’email
  const resetLink = `http://${req.headers.host}/api/users/reset-password/${token}`;
  const html = `
    <p>Bonjour ${user.firstname},</p>
    <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci‑dessous :</p>
    <a href="${resetLink}">Réinitialiser mon mot de passe</a>
    <p>Le lien est valide 1 heure.</p>
  `;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: "Réinitialisation du mot de passe",
    html
  });

  res.send({ success:true, message: "Email de réinitialisation envoyé" });
});
router.get("/reset-password/:token", async (req, res) => {
  const { token } = req.params
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  })

  if (!user) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lien expiré - Réinitialisation</title>
        <style>
          :root {
            --primary-color: #6366f1;
            --error-color: #ef4444;
            --text-primary: #1e293b;
            --background: #ffffff;
            --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            --radius: 12px;
          }

          * { box-sizing: border-box; }

          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }

          .error-container {
            background: var(--background);
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
            padding: 2.5rem;
            text-align: center;
            max-width: 420px;
            animation: slideUp 0.6s ease-out;
          }

          @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .error-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
            animation: pulse 2s infinite;
          }

          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }

          .error-title {
            color: var(--error-color);
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 1rem;
          }

          .error-message {
            color: var(--text-primary);
            margin-bottom: 2rem;
            line-height: 1.6;
          }

          .back-link {
            display: inline-block;
            background: linear-gradient(135deg, var(--primary-color), #4f46e5);
            color: white;
            text-decoration: none;
            padding: 0.75rem 1.5rem;
            border-radius: var(--radius);
            font-weight: 600;
            transition: all 0.3s ease;
          }

          .back-link:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <div class="error-icon">⚠️</div>
          <h1 class="error-title">Lien expiré</h1>
          <p class="error-message">
            Ce lien de réinitialisation est invalide ou a expiré.
            Veuillez demander un nouveau lien de réinitialisation.
          </p>
          <a href="/forgot-password" class="back-link">
            Demander un nouveau lien
          </a>
        </div>
      </body>
      </html>
    `)
  }

  // Formulaire moderne pour la réinitialisation
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Réinitialiser votre mot de passe</title>
      <style>
        :root {
          --primary-color: #6366f1;
          --primary-dark: #4f46e5;
          --success-color: #10b981;
          --error-color: #ef4444;
          --text-primary: #1e293b;
          --text-secondary: #64748b;
          --background: #ffffff;
          --border: #e2e8f0;
          --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          --radius: 12px;
          --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          position: relative;
          overflow: hidden;
        }

        body::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M20 20c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10zm10 0c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10z'/%3E%3C/g%3E%3C/svg%3E") repeat;
          animation: rotate 30s linear infinite;
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .reset-container {
          background: var(--background);
          border-radius: var(--radius);
          box-shadow: var(--shadow-lg);
          padding: 2.5rem;
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
          animation: bounceIn 0.8s ease-out;
        }

        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { opacity: 1; transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }

        .reset-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .reset-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .reset-title {
          font-size: 1.875rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        .reset-subtitle {
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .reset-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          position: relative;
        }

        .form-label {
          display: block;
          color: var(--text-primary);
          font-weight: 600;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        .form-input {
          width: 100%;
          padding: 1rem 1rem 1rem 3rem;
          border: 2px solid var(--border);
          border-radius: var(--radius);
          font-size: 1rem;
          transition: var(--transition);
          background: var(--background);
          position: relative;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .form-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-secondary);
          transition: var(--transition);
          pointer-events: none;
        }

        .form-input:focus + .form-icon {
          color: var(--primary-color);
          transform: translateY(-50%) scale(1.1);
        }

        .password-toggle {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-secondary);
          padding: 0.25rem;
          border-radius: 4px;
          transition: var(--transition);
        }

        .password-toggle:hover {
          color: var(--primary-color);
          background: rgba(99, 102, 241, 0.1);
        }

        .password-strength {
          margin-top: 0.5rem;
          height: 4px;
          background: var(--border);
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }

        .password-strength::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: linear-gradient(90deg, #ef4444, #f59e0b, #10b981);
          border-radius: 2px;
          transition: width 0.3s ease;
          width: 0%;
        }

        .strength-weak::after { width: 33%; }
        .strength-medium::after { width: 66%; }
        .strength-strong::after { width: 100%; }

        .strength-text {
          font-size: 0.75rem;
          margin-top: 0.25rem;
          color: var(--text-secondary);
        }

        .reset-button {
          background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: var(--radius);
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          position: relative;
          overflow: hidden;
        }

        .reset-button::before {
          content: "";
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
          transition: left 0.5s;
        }

        .reset-button:hover::before {
          left: 100%;
        }

        .reset-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
        }

        .reset-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .back-link {
          text-align: center;
          margin-top: 1.5rem;
        }

        .back-link a {
          color: var(--primary-color);
          text-decoration: none;
          font-weight: 500;
          transition: var(--transition);
          font-size: 0.9rem;
        }

        .back-link a:hover {
          color: var(--primary-dark);
          transform: translateY(-1px);
        }

        .success-message {
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);
          color: #065f46;
          padding: 1rem;
          border-radius: var(--radius);
          margin-bottom: 1.5rem;
          border-left: 4px solid var(--success-color);
          animation: slideIn 0.5s ease-out;
          display: none;
        }

        .error-message {
          background: linear-gradient(135deg, #fee2e2, #fecaca);
          color: #991b1b;
          padding: 1rem;
          border-radius: var(--radius);
          margin-bottom: 1.5rem;
          border-left: 4px solid var(--error-color);
          animation: shake 0.5s ease-out;
          display: none;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        @media (max-width: 480px) {
          .reset-container {
            padding: 1.5rem;
            margin: 1rem;
          }

          .reset-title {
            font-size: 1.5rem;
          }

          .form-input {
            padding: 0.875rem 0.875rem 0.875rem 2.5rem;
          }

          .reset-button {
            padding: 0.875rem 1.5rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="reset-container">
        <div class="reset-header">
          <div class="reset-icon">🔐</div>
          <h1 class="reset-title">Nouveau mot de passe</h1>
          <p class="reset-subtitle">
            Choisissez un mot de passe sécurisé pour votre compte
          </p>
        </div>

        <div class="success-message" id="successMessage">
          ✅ Mot de passe réinitialisé avec succès ! Redirection en cours...
        </div>

        <div class="error-message" id="errorMessage">
          ❌ <span id="errorText"></span>
        </div>

        <form action="/api/users/reset-password/${token}" method="POST" class="reset-form" id="resetForm">
          <div class="form-group">
            <label for="newPassword" class="form-label">Nouveau mot de passe</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              placeholder="Entrez votre nouveau mot de passe"
              required
              minlength="8"
              class="form-input"
            />
            <div class="form-icon">🔒</div>
            <button type="button" class="password-toggle" onclick="togglePassword('newPassword')">
              👁️
            </button>
            <div class="password-strength" id="passwordStrength"></div>
            <div class="strength-text" id="strengthText"></div>
          </div>

          <div class="form-group">
            <label for="confirmPassword" class="form-label">Confirmer le mot de passe</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              placeholder="Confirmez votre nouveau mot de passe"
              required
              class="form-input"
            />
            <div class="form-icon">🔒</div>
            <button type="button" class="password-toggle" onclick="togglePassword('confirmPassword')">
              👁️
            </button>
          </div>

          <button type="submit" class="reset-button" id="submitButton">
            <span id="buttonText">
              ✅ Réinitialiser le mot de passe
            </span>
          </button>
        </form>

        <div class="back-link">
          <a href="/login">← Retour à la connexion</a>
        </div>
      </div>

      <script>
        // Toggle password visibility
        function togglePassword(inputId) {
          const input = document.getElementById(inputId);
          const button = input.nextElementSibling.nextElementSibling;

          if (input.type === 'password') {
            input.type = 'text';
            button.textContent = '🙈';
          } else {
            input.type = 'password';
            button.textContent = '👁️';
          }
        }

        // Password strength checker
        const passwordInput = document.getElementById('newPassword');
        const strengthIndicator = document.getElementById('passwordStrength');
        const strengthText = document.getElementById('strengthText');

        passwordInput.addEventListener('input', function() {
          const password = this.value;
          const strength = calculatePasswordStrength(password);

          strengthIndicator.className = 'password-strength';

          if (strength < 3) {
            strengthIndicator.classList.add('strength-weak');
            strengthText.textContent = 'Faible';
            strengthText.style.color = '#ef4444';
          } else if (strength < 5) {
            strengthIndicator.classList.add('strength-medium');
            strengthText.textContent = 'Moyen';
            strengthText.style.color = '#f59e0b';
          } else {
            strengthIndicator.classList.add('strength-strong');
            strengthText.textContent = 'Fort';
            strengthText.style.color = '#10b981';
          }
        });

        function calculatePasswordStrength(password) {
          let strength = 0;
          if (password.length >= 8) strength++;
          if (/[a-z]/.test(password)) strength++;
          if (/[A-Z]/.test(password)) strength++;
          if (/[0-9]/.test(password)) strength++;
          if (/[^A-Za-z0-9]/.test(password)) strength++;
          return strength;
        }

        // Form submission with validation
        document.getElementById('resetForm').addEventListener('submit', function(e) {
          const password = document.getElementById('newPassword').value;
          const confirm = document.getElementById('confirmPassword').value;
          const errorMessage = document.getElementById('errorMessage');
          const errorText = document.getElementById('errorText');
          const submitButton = document.getElementById('submitButton');
          const buttonText = document.getElementById('buttonText');

          // Hide previous errors
          errorMessage.style.display = 'none';

          // Validation
          if (password !== confirm) {
            e.preventDefault();
            errorText.textContent = 'Les mots de passe ne correspondent pas';
            errorMessage.style.display = 'block';
            return;
          }

          if (password.length < 8) {
            e.preventDefault();
            errorText.textContent = 'Le mot de passe doit contenir au moins 8 caractères';
            errorMessage.style.display = 'block';
            return;
          }

          // Show loading state
          submitButton.disabled = true;
          buttonText.innerHTML = '<div class="loading-spinner"></div> Réinitialisation...';
        });

        // Handle form response (if using AJAX)
        function handleSuccess() {
          document.getElementById('successMessage').style.display = 'block';
          document.getElementById('resetForm').style.display = 'none';
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
        }

        function handleError(message) {
          const errorMessage = document.getElementById('errorMessage');
          const errorText = document.getElementById('errorText');
          const submitButton = document.getElementById('submitButton');
          const buttonText = document.getElementById('buttonText');

          errorText.textContent = message;
          errorMessage.style.display = 'block';

          submitButton.disabled = false;
          buttonText.innerHTML = '✅ Réinitialiser le mot de passe';
        }
      </script>
    </body>
    </html>
  `)
})
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <title>Lien expiré</title>
        </head>
        <body style="font-family:sans-serif;text-align:center;background:#f8f8f8;padding:50px;">
          <h1 style="color:#ef4444;">❌ Lien invalide ou expiré</h1>
          <p>Ce lien de réinitialisation a expiré ou est invalide.</p>
          <a href="/forgot-password">Demander un nouveau lien</a>
        </body>
        </html>
      `);
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Réponse HTML simple sans bouton
    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Mot de passe réinitialisé</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #10b981, #059669);
          }
          .container {
            background: #ffffff;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
          }
          .icon {
            font-size: 3rem;
            color: #10b981;
            margin-bottom: 1rem;
          }
          h1 {
            font-size: 1.8rem;
            color: #1e293b;
            margin-bottom: 1rem;
          }
          p {
            color: #4b5563;
            font-size: 1rem;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1>Mot de passe réinitialisé</h1>
          <p>Votre mot de passe a été changé avec succès.<br/>Vous pouvez maintenant vous connecter.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("Erreur lors de la réinitialisation:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="UTF-8"><title>Erreur</title></head>
      <body style="font-family:sans-serif;text-align:center;background:#ffecec;padding:50px;">
        <h1 style="color:#dc2626;">⚠️ Erreur serveur</h1>
        <p>Une erreur est survenue. Veuillez réessayer plus tard.</p>
        <a href="/forgot-password">Retour</a>
      </body>
      </html>
    `);
  }
});




module.exports = router;