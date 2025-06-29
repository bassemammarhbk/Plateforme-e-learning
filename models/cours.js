const mongoose = require('mongoose');

const coursSchema = new mongoose.Schema({
    sousFiliereId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SousFiliere',
        required: true
    },
    nomcours: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
        type: String,
        unique: true
    },
    imagecours: {
        type: String,
        required: false
    },
    duree: {
        type: String,
        required: false
    },
    niveau: {
        type: String,
        enum: ['debutant', 'intermediaire', 'avancé'],
        lowercase: true,
        trim: true
    },
    description: {
        type: String,
        required: false
    },
    contenu: [{
        titreChapitre: { type: String, required: true },
        titreType: { type: String, required: true },
        type: { type: String, enum: ['video', 'pdf', 'texte', 'image'] },
        url: { type: String, required: true },
        texte: { type: String, required: false },
        duree: { type: String, required: true },
        quiz: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }]
    }],
    finalTest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Quiz"
    },
    enseignantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

coursSchema.pre("save", function (next) {
    if (this.isModified("nomcours")) {
        this.slug = this.nomcours
            .toLowerCase()
            .replace(/[^a-zA-Z0-9]/g, "-")
            .replace(/-+/g, "-");
    }
    next();
});

module.exports = mongoose.model('Cours', coursSchema);