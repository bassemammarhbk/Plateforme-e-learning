const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  firstname: {
    type: String,
    required: true,
    trim: true
  },
  lastname: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['etudiant', 'enseignant', 'admin'],
    default: 'etudiant'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String
  },
  tel: {
    type: Number
  },
  sexe: {
    type: String,
    enum: ['homme', 'femme']
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  activationToken: String,
  activationTokenExpires: Date
}, {
  timestamps: true
});

// Avant sauvegarde: hasher le mot de passe si modifié
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Méthode pour générer un token de réinitialisation
userSchema.methods.createPasswordResetToken = function () {
  // Génération d'un token en clair
  const resetToken = crypto.randomBytes(32).toString('hex');

  // On peut hasher ce token avant stockage pour plus de sécurité
  this.resetPasswordToken = crypto.createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Expiration dans 1h
  this.resetPasswordExpires = Date.now() + 3600000;

  return resetToken;
};

// Vérification du mot de passe
userSchema.methods.correctPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
