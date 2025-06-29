const express = require('express');
const router = express.Router();
const cours = require('../models/cours');
const { authorizeRoles } = require('../middlwares/authorizeRoles');
const { verifyToken } = require('../middlwares/verifToken');
const Quiz = require('../models/quiz');
const Filiere = require('../models/filiere');
const soufiliere = require('../models/sousfiliere')
const enseignant = require('../models/enseignant');
const user = require('../models/user');
const Etudiant = require('../models/etudiant');
const Newsletter = require('../models/newsletter');
const nodemailer = require('nodemailer');
const { generateMongoQuery } = require("../query/generateMongoQuery");

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


router.get('/', async (req, res) => {
    try {
        const coursData = await cours
            .find({}, null, { sort: { _id: -1 } })
            .populate({
                path: 'sousFiliereId',
                select: 'nomSousFiliere',
                populate: {
                    path: 'filiereId',
                    select: 'nomfiliere'
                }
            })
            .populate('enseignantId', 'firstname lastname');

        res.status(200).json(coursData);
    } catch (error) {
        console.error('Erreur GET /cours :', error);
        res.status(404).json({ message: error.message });
    }
});

router.post('/', verifyToken, authorizeRoles('enseignant'), async (req, res) => {
  try {
    const currentUser = await user.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Création du cours
    const newCours = new cours({
      ...req.body,
      enseignantId: currentUser._id
    });
    await newCours.save();

    // Promotion automatique si étudiant
    if (currentUser.role === 'etudiant') {
      currentUser.role = 'enseignant';
      await currentUser.save();

      const existingEnseignant = await enseignant.findOne({ userId: currentUser._id });
      if (!existingEnseignant) {
        const newEnseignant = new enseignant({
          userId: currentUser._id,
          specialite: 'À définir',
          tel: currentUser.tel
        });
        await newEnseignant.save();
      }
    }

    // Populer les infos pour la newsletter (sousFiliere & filiere)
    const coursPopulated = await cours.findById(newCours._id)
      .populate({
        path: 'sousFiliereId',
        select: 'nomSousFiliere filiereId',
        populate: {
          path: 'filiereId',
          select: 'nomfiliere'
        }
      });

    // Envoi de la newsletter
    try {
      const abonnés = await Newsletter.find({}, 'email');
      const destinataires = abonnés.map(sub => sub.email);

      if (destinataires.length > 0) {
        const nomCours = coursPopulated.nomcours || 'Nouveau cours';
        const nomSousFiliere = coursPopulated.sousFiliereId?.nomSousFiliere || 'Sous-filière inconnue';
        const nomFiliere = coursPopulated.sousFiliereId?.filiereId?.nomfiliere || 'Filière inconnue';

        const mailOptions = {
          from: `"Learnista Cours" <${process.env.EMAIL_USER}>`,
          to: destinataires.join(','),
          subject: `🆕 Nouveau cours : ${nomCours} (${nomFiliere} / ${nomSousFiliere})`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
              <!-- Header -->
              <div style="text-align: center; padding: 10px 0; background-color: #007bff; color: white; border-radius: 5px 5px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">Nouveau Cours Disponible !</h1>
              </div>

              <!-- Body -->
              <div style="padding: 20px; background-color: white; border-radius: 0 0 5px 5px;">
                <h2 style="color: #333; font-size: 20px; margin-bottom: 10px;">Bonjour cher abonné,</h2>
                <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                  Nous sommes ravis de vous annoncer qu'un nouveau cours a été ajouté à notre plateforme. Voici les détails :
                </p>
                <div style="background-color: #f1f1f1; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                  <p style="margin: 0; font-size: 16px; color: #333;"><strong>📘 Cours :</strong> ${nomCours}</p>
                  <p style="margin: 0; font-size: 16px; color: #333;"><strong>🎓 Filière :</strong> ${nomFiliere}</p>
                  <p style="margin: 0; font-size: 16px; color: #333;"><strong>📂 Sous-filière :</strong> ${nomSousFiliere}</p>
                </div>
                <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                  Ne manquez pas cette opportunité d'enrichir vos connaissances. Cliquez sur le bouton ci-dessous pour découvrir le cours dès maintenant !
                </p>
                <div style="text-align: center; margin-bottom: 20px;">
                  <a href="https://ton-site.com/cours/${newCours._id}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">Découvrir le cours</a>
                </div>
                <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                  Si vous avez des questions ou besoin d'assistance, n'hésitez pas à nous contacter.
                </p>
                <p style="color: #555; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                  À bientôt sur Learnista ✨
                </p>
              </div>

              <!-- Footer -->
              <div style="text-align: center; padding: 10px 0; color: #777; font-size: 14px;">
                <p style="margin: 0;">Vous recevez cet email car vous êtes abonné à notre newsletter.</p>
                <p style="margin: 0;"><a href="https://ton-site.com/desinscription" style="color: #007bff; text-decoration: none;">Se désinscrire</a></p>
              </div>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log("✅ Newsletter envoyée aux abonnés !");
      }
    } catch (err) {
      console.error("❌ Erreur d’envoi newsletter :", err);
    }

    res.status(201).json({
      cours: newCours,
      updatedUser: currentUser
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.put('/:courId', verifyToken, authorizeRoles('enseignant'), async (req, res) => {
    try {
        const courId = req.params.courId;
        const coursExist = await cours.findById(courId);
        if (!coursExist) {
            return res.status(404).json({ message: 'Cours non trouvé' });
        }
        if (coursExist.enseignantId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier ce cours' });
        }
        const updatedCours = await cours.findByIdAndUpdate(
            courId,
            { $set: req.body },
            { new: true, runValidators: true }
        );
        res.status(200).json(updatedCours);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du cours:', error);
        res.status(400).json({ message: 'Erreur lors de la mise à jour du cours', error: error.message });
    }
});

router.patch('/:courId/contenu', verifyToken, authorizeRoles('enseignant'), async (req, res) => {
    try {
        const courId = req.params.courId;
        const newContenu = req.body;
        const coursExist = await cours.findById(courId);
        if (!coursExist) {
            return res.status(404).json({ message: 'Cours non trouvé' });
        }
        if (coursExist.enseignantId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier ce cours' });
        }
        const updatedCours = await cours.findByIdAndUpdate(
            courId,
            { $push: { contenu: newContenu } },
            { new: true, runValidators: true }
        );
        res.status(200).json(updatedCours);
    } catch (error) {
        console.error('Erreur lors de l\'ajout du contenu:', error);
        res.status(400).json({
            message: 'Erreur lors de l\'ajout du contenu',
            error: error.message,
            details: error.errors || error,
        });
    }
});

router.put('/:courId/contenu/:contenuId', verifyToken, authorizeRoles('enseignant'), async (req, res) => {
    try {
        const courId = req.params.courId;
        const contenuId = req.params.contenuId;
        const updatedContenu = req.body;
        const coursExist = await cours.findById(courId);
        if (!coursExist) {
            return res.status(404).json({ message: 'Cours non trouvé' });
        }
        if (coursExist.enseignantId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier ce cours' });
        }
        const updatedCours = await cours.findOneAndUpdate(
            { _id: courId, 'contenu._id': contenuId },
            { $set: { 'contenu.$': updatedContenu } },
            { new: true, runValidators: true }
        );
        if (!updatedCours) {
            return res.status(404).json({ message: 'Contenu non trouvé' });
        }
        res.status(200).json({ message: 'Contenu mis à jour avec succès', cours: updatedCours });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du contenu:', error);
        res.status(400).json({
            message: 'Erreur lors de la mise à jour du contenu',
            error: error.message,
            details: error.errors || error
        });
    }
});

router.delete('/:courId', verifyToken, authorizeRoles('enseignant'), async (req, res) => {
    try {
        const courId = req.params.courId;
        const coursExist = await cours.findById(courId);
        if (!coursExist) {
            return res.status(404).json({ message: 'Cours non trouvé' });
        }
        if (coursExist.enseignantId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à supprimer ce cours' });
        }
        await cours.findByIdAndDelete(courId);
        res.status(200).json({ message: "Cours supprimé avec succès" });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la suppression du cours", error: error.message });
    }
});

router.delete('/:courId/contenu/:contenuId', verifyToken, authorizeRoles('enseignant'), async (req, res) => {
    try {
        const courId = req.params.courId;
        const contenuId = req.params.contenuId;
        const coursExist = await cours.findById(courId);
        if (!coursExist) {
            return res.status(404).json({ message: 'Cours non trouvé' });
        }
        if (coursExist.enseignantId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier ce cours' });
        }
        const updatedCours = await cours.findByIdAndUpdate(
            courId,
            { $pull: { contenu: { _id: contenuId } } },
            { new: true }
        );
        if (!updatedCours) {
            return res.status(404).json({ message: 'Contenu non trouvé' });
        }
        res.status(200).json({ message: 'Contenu supprimé avec succès', cours: updatedCours });
    } catch (error) {
        console.error('Erreur lors de la suppression du contenu:', error);
        res.status(400).json({ message: 'Erreur lors de la suppression du contenu', error: error.message });
    }
});
// Récupérer tous les cours d'une sous-filière donnée
router.get('/sous-filiere/:sousFiliereId', async (req, res) => {
  try {
    const { sousFiliereId } = req.params;
    // On suppose que vos cours ont bien un champ sousFiliereId
    const coursData = await cours
      .find({ sousFiliereId })
      .populate({
        path: 'sousFiliereId',
        select: 'nomSousFiliere'
      })
      .populate('enseignantId', 'firstname lastname');
    return res.status(200).json(coursData);
  } catch (error) {
    console.error(`Erreur GET /cours/sous-filiere/${req.params.sousFiliereId}:`, error);
    return res.status(500).json({ message: error.message });
  }
});


router.get('/:coursId', async (req, res) => {
    try {
        const cour = await cours.findById(req.params.coursId)
            .populate({
                path: 'sousFiliereId',
                select: 'nomSousFiliere',
                populate: {
                    path: 'filiereId',
                    select: 'nomfiliere'
                }
            })
            .populate('enseignantId', 'firstname lastname');
        res.status(200).json(cour);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

router.get('/enseignant/:enseignantId', async (req, res) => {
    try {
        const coursData = await cours
            .find({ enseignantId: req.params.enseignantId })
            .populate({
                path: 'sousFiliereId',
                select: 'nomSousFiliere',
                populate: {
                    path: 'filiereId',
                    select: 'nomfiliere'
                }
            });
        res.status(200).json(coursData);
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la récupération des cours de l'enseignant", error: error.message });
    }
});
router.post("/query", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Aucune requête fournie." });

    console.log("Requête reçue:", text);
    const mongoQuery = await generateMongoQuery(text);
    console.log("Requête MongoDB générée avant correction:", mongoQuery);

    let query = mongoQuery.filter || {};
    const sort = mongoQuery.sort || { _id: -1 };
    const limit = mongoQuery.limit ? parseInt(mongoQuery.limit) : 0;
    const skip = mongoQuery.skip ? parseInt(mongoQuery.skip) : 0;

    let sousFiliereName = null;
    if (query["sousFiliereId.nomSousFiliere"]) {
      sousFiliereName = query["sousFiliereId.nomSousFiliere"];
      delete query["sousFiliereId.nomSousFiliere"];
    } else if (query.sousFiliere) {
      sousFiliereName = query.sousFiliere;
      delete query.sousFiliere;
    } else if (query.sousFiliereId && typeof query.sousFiliereId === "string") {
      sousFiliereName = query.sousFiliereId;
    }

    let filiereName = null;
    if (query["sousFiliereId.filiereId.nomfiliere"]) {
      filiereName = query["sousFiliereId.filiereId.nomfiliere"];
      delete query["sousFiliereId.filiereId.nomfiliere"];
    } else if (query.filiere) {
      filiereName = query.filiere;
      delete query.filiere;
    } else if (query.filiereId && typeof query.filiereId === "string") {
      filiereName = query.filiereId;
    }

    if (sousFiliereName) {
      console.log("Recherche de l'ID de la sous-filière pour :", sousFiliereName);
      const sousFiliere = await soufiliere.findOne({
        nomSousFiliere: { $regex: sousFiliereName, $options: "i" }
      });
      if (!sousFiliere) {
        console.log("Aucune sous-filière trouvée pour:", sousFiliereName);
        return res.json({ result: [], message: "Aucune sous-filière correspondante trouvée." });
      }
      console.log("Sous-filière trouvée:", sousFiliere._id);
      query.sousFiliereId = sousFiliere._id;
    }

    if (filiereName) {
      console.log("Recherche de l'ID de la filière pour :", filiereName);
      const filiere = await Filiere.findOne({
        nomfiliere: { $regex: filiereName, $options: "i" }
      });
      if (!filiere) {
        console.log("Aucune filière trouvée pour:", filiereName);
        return res.json({ result: [], message: "Aucune filière correspondante trouvée." });
      }
      console.log("Filière trouvée:", filiere._id);
      const sousFilieres = await soufiliere.find({ filiereId: filiere._id });
      if (sousFilieres.length === 0) {
        console.log("Aucune sous-filière trouvée pour la filière:", filiereName);
        return res.json({ result: [], message: "Aucune sous-filière associée à cette filière." });
      }
      const sousFiliereIds = sousFilieres.map(sf => sf._id);
      console.log("Sous-filière IDs trouvés:", sousFiliereIds);
      query.sousFiliereId = { $in: sousFiliereIds };
    }

    console.log("Requête finale exécutée sur MongoDB:", JSON.stringify(query, null, 2));

    if (/nombre|combien|count/i.test(text)) {
      const count = await cours.countDocuments(query);
      console.log(`📊 Nombre de cours trouvés: ${count}`);
      return res.json({ count });
    }

    const result = await cours.find(query)
      .populate({
        path: "sousFiliereId",
        populate: { path: "filiereId" }
      })
      .sort(sort)
      .skip(skip)
      .limit(limit > 0 ? limit : 0)
      .exec();

    console.log(`${result.length} cours trouvés.`);
    res.json({ result });
  } catch (error) {
    console.error("Erreur serveur:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;