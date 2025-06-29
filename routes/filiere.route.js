const express = require('express');
const router = express.Router();
const filiere = require("../models/filiere");
const cours = require("../models/cours");
const SousFiliere = require("../models/sousfiliere");

router.get('/avec-cours', async (req, res) => {
    try {
        const filieres = await filiere.find();

        const filieresAvecCours = await Promise.all(
            filieres.map(async (fil) => {
                const sousFilieres = await SousFiliere.find({ filiereId: fil._id });
                const sousFiliereIds = sousFilieres.map(sf => sf._id);
                const coursAssocies = await cours.find({ sousFiliereId: { $in: sousFiliereIds } }).select('nomcours');
                return {
                    ...fil.toObject(),
                    cours: coursAssocies.map(c => c.nomcours)
                };
            })
        );

        res.status(200).json(filieresAvecCours);
    } catch (error) {
        console.error("Erreur /avec-cours :", error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/avec-cours/:id', async (req, res) => {
    try {
        const maFiliere = await filiere.findById(req.params.id);
        if (!maFiliere) {
            return res.status(404).json({ message: "Filière non trouvée" });
        }

        const sousFilieres = await SousFiliere.find({ filiereId: maFiliere._id });
        const sousFiliereIds = sousFilieres.map(sf => sf._id);
        const coursAssocies = await cours.find({ sousFiliereId: { $in: sousFiliereIds } })
            .select('nomcours imagecours duree niveau description contenu');

        const filiereAvecCours = {
            ...maFiliere.toObject(),
            cours: coursAssocies
        };

        res.status(200).json(filiereAvecCours);
    } catch (error) {
        console.error("Erreur détaillée:", error);
        res.status(500).json({
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

router.get('/', async (req, res) => {
    try {
        const fil = await filiere.find({}, null, { sort: { '_id': -1 } });
        res.status(200).json(fil);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    const newfiliere = new filiere(req.body);
    try {
        await newfiliere.save();
        res.status(200).json(newfiliere);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

router.put('/:filiereID', async (req, res) => {
    try {
        const fil1 = await filiere.findByIdAndUpdate(
            req.params.filiereID,
            { $set: req.body },
            { new: true }
        );
        res.status(200).json(fil1);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

router.delete('/:filiereID', async (req, res) => {
    const id = req.params.filiereID;
    await filiere.findByIdAndDelete(id);
    res.json({ message: "Filiere est supprimé avec succés" });
});

router.get('/:filiereID', async (req, res) => {
    try {
        const fil1 = await filiere.findById(req.params.filiereID);
        res.status(200).json(fil1);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
});

module.exports = router;