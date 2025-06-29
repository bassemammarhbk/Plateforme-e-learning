const express = require('express');
const router = express.Router();
const SousFiliere = require('../models/sousfiliere');
const Filiere = require('../models/filiere');

// GET all sous-filieres
router.get('/', async (req, res) => {
  try {
    const subs = await SousFiliere.find().populate('filiereId', 'nomfiliere');
    res.status(200).json(subs);
  } catch (error) {
    console.error('Erreur GET /sousfilieres:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET sous-filieres by filiere
router.get('/by-filiere/:filiereId', async (req, res) => {
  try {
    const { filiereId } = req.params;
    // Check existence
    const fil = await Filiere.findById(filiereId);
    if (!fil) return res.status(404).json({ message: 'Filière non trouvée' });

    const subs = await SousFiliere.find({ filiereId });
    res.status(200).json(subs);
  } catch (error) {
    console.error('Erreur GET /sousfilieres/by-filiere/:id:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST create sous-filiere
router.post('/', async (req, res) => {
  try {
    const { nomSousFiliere, filiereId, description , imageSousFiliere } = req.body;
    const newSub = new SousFiliere({ nomSousFiliere, filiereId, description , imageSousFiliere });
    await newSub.save();
    res.status(201).json(newSub);
  } catch (error) {
    console.error('Erreur POST /sousfilieres:', error);
    res.status(400).json({ message: error.message });
  }
});

// PUT update
router.put('/:id', async (req, res) => {
  const updated = await SousFiliere.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  ).populate('filiereId');            // ← important !
  res.json(updated);
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const del = await SousFiliere.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ message: 'Sous-filière non trouvée' });
    res.status(200).json({ message: 'Supprimé avec succès' });
  } catch (error) {
    console.error('Erreur DELETE /sousfilieres/:id:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
