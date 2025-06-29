const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlwares/verifToken');
const User = require('../models/user');

router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userprofile = await User.findOne({ _id: req.user.id }, '-password');
    if (!userprofile) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(userprofile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/profile/:userId', verifyToken, async (req, res) => {
    try {

        // Mettre à jour l'utilisateur avec l'ID dans l'URL
        const updatedUser = await User.findByIdAndUpdate(
            req.params.userId, // Utilisation de l'ID passé dans l'URL
            { $set: req.body },  // Données envoyées dans le body de la requête
            { new: true }        // Retourner le nouvel utilisateur après la mise à jour
        );

        // Vérifier si l'utilisateur a été trouvé et mis à jou

        // Répondre avec l'utilisateur mis à jour
        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});




module.exports = router;