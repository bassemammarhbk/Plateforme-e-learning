const mongoose = require('mongoose');

const sousFiliereSchema = new mongoose.Schema({
  nomSousFiliere: { type: String, required: true, unique: true },
  filiereId: { type: mongoose.Schema.Types.ObjectId, ref: 'Filiere', required: true },
  description: { type: String },
  imageSousFiliere: {
     type: String
    }, 
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SousFiliere', sousFiliereSchema);