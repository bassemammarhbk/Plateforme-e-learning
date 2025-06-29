const mongoose = require('mongoose');

const forumSchema = new mongoose.Schema({
    coursId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cours', required: true },
    utilisateurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    dateMessage: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Forum', forumSchema);