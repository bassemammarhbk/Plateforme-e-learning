const mongoose = require("mongoose");

const CertificatSchema = new mongoose.Schema(
  {
    etudiant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Etudiant",
      required: true,
    },
    cours: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cours",
      required: true,
    },
    title: {
      type: String,
      default: "Certificat de réussite",
    },
    finalScore: {
      type: Number,
      required: true,
    }
  },
  { timestamps: true }
);


CertificatSchema.pre("save", function (next) {
  if (!this.verificationCode) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.verificationCode = code;
  }
  next();
});

module.exports = mongoose.model("Certification", CertificatSchema);