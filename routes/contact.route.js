const express = require('express');
const router = express.Router();
const ContactMessage = require('../models/contact');

/**
 * @route   POST /api/contact
 * @desc    Envoyer un message de contact à l'administrateur
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }
    const contactMessage = new ContactMessage({ name, email, subject, message });
    await contactMessage.save();
    res.status(201).json({ message: 'Votre message a été envoyé avec succès.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/**
 * @route   GET /api/contact
 * @desc    Récupérer tous les messages de contact (admin)
 * @access  Private/Admin
 */
router.get('/', async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/**
 * @route   PATCH /api/contact/:id/read
 * @desc    Marquer un message comme lu
 * @access  Private/Admin
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const msg = await ContactMessage.findById(req.params.id);
    if (!msg) {
      return res.status(404).json({ error: 'Message non trouvé.' });
    }
    msg.isRead = true;
    await msg.save();
    res.json({ success: true, message: 'Message marqué comme lu.', msg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

/**
 * @route   DELETE /api/contact/:id
 * @desc    Supprimer un message de contact
 * @access  Private/Admin
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Message non trouvé.' });
    }
    res.json({ success: true, message: 'Message supprimé avec succès.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
