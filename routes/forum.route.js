const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Forum = require('../models/forum');
const { verifyToken } = require('../middlwares/verifToken');
const { authorizeRoles } = require('../middlwares/authorizeRoles');

// Récupérer tous les messages pour un cours spécifique
router.get('/:coursId', verifyToken, async (req, res) => {
  try {
    const coursId = new mongoose.Types.ObjectId(req.params.coursId); // Conversion en ObjectId
    const messages = await Forum.find({ coursId })
      .populate('utilisateurId', 'firstname lastname role')
      .sort({ dateMessage: 1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des messages', error: error.message });
  }
});

// Poster un nouveau message pour un cours spécifique
router.post('/:coursId', verifyToken, authorizeRoles('etudiant', 'enseignant'), async (req, res) => {
  try {
    const coursId = new mongoose.Types.ObjectId(req.params.coursId); // Conversion en ObjectId
    const newMessage = new Forum({
      coursId,
      utilisateurId: req.user.id,
      message: req.body.message,
      dateMessage: new Date()
    });
    await newMessage.save();
    const populatedMessage = await Forum.findById(newMessage._id)
      .populate('utilisateurId', 'firstname lastname role');
    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la publication du message', error: error.message });
  }
});

// Supprimer un message
router.delete('/:coursId/:messageId', verifyToken, async (req, res) => {
  try {
    const message = await Forum.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message non trouvé' });
    }
    if (message.utilisateurId.toString() !== req.user.id && req.user.role !== 'enseignant') {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    await Forum.findByIdAndDelete(req.params.messageId);
    res.status(200).json({ message: 'Message supprimé' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du message', error: error.message });
  }
});

// Modifier un message
router.put('/:coursId/:messageId', verifyToken, async (req, res) => {
  try {
    const message = await Forum.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message non trouvé' });
    }
    if (message.utilisateurId.toString() !== req.user.id && req.user.role !== 'enseignant') {
      return res.status(403).json({ message: 'Non autorisé' });
    }
    message.message = req.body.message;
    message.dateMessage = new Date();
    await message.save();
    const populatedMessage = await Forum.findById(message._id)
      .populate('utilisateurId', 'firstname lastname role');
    res.status(200).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la modification du message', error: error.message });
  }
});

module.exports = router;