// app.js (version corrigée)
require("dotenv").config(); // toujours avant d'utiliser process.env
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const filiereRouter = require("./routes/filiere.route");
const coursRouter = require("./routes/cours.route");
const userRouter = require("./routes/user.route");
const profileRouter = require("./routes/profile.route");
const quizRouter = require("./routes/quiz.route");
const certificatRouter = require("./routes/certificat.route");
const forumRouter = require("./routes/forum.route");
const sousFilieresRouter = require("./routes/sousfiliere.route");
const newsletterRouter = require("./routes/newsletter.route");
const contactRouter = require("./routes/contact.route");

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS : en prod préfère définir FRONTEND_URL dans les env (ex : https://ton-frontend.vercel.app)
const FRONTEND_URL = process.env.FRONTEND_URL || "*";
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

// Connexion à MongoDB (prod: DATABASECLOUD, local fallback: DATABASE)
const DB_URI = process.env.DATABASECLOUD || process.env.DATABASE || "mongodb://127.0.0.1:27017/elearning";

mongoose
  .connect(DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    // Si la DB n'est pas joignable en prod, on arrête le process (optionnel mais recommandé)
    process.exit(1);
  });

// Routes API
app.use("/api/filiere", filiereRouter);
app.use("/api/cours", coursRouter);
app.use("/api/users", userRouter);
app.use("/api/profile", profileRouter); // route séparée pour profil
app.use("/api/quizzes", quizRouter);
app.use("/api/certificats", certificatRouter);
app.use("/api/forum", forumRouter);
app.use("/api/sous-filieres", sousFilieresRouter);
app.use("/api/newsletter", newsletterRouter);
app.use("/api/contact", contactRouter);

// Serve client build only in production
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "client", "build");
  app.use(express.static(clientBuildPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
} else {
  // simple route pour vérifier que l'API est en ligne en dev
  app.get("/", (req, res) => res.send("API en ligne"));
}

// PORT from env (Render fournit process.env.PORT)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Serveur listening on port ${PORT}`);
});

module.exports = app;