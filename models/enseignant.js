const mongoose = require('mongoose');
const User = require('./user');

const enseignantSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'User'
    },
    specialite: {
        type: String,
        required: false
    },
}, {timestamps: true});


module.exports = mongoose.model('Enseignant', enseignantSchema);
