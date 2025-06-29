const express = require("express")
const router = express.Router()
const Quiz = require("../models/quiz")
const User = require('../models/user')
const Cours = require ('../models/cours')
const Etudiant = require ('../models/etudiant')
const { verifyToken } = require("../middlwares/verifToken")
const { authorizeRoles } = require("../middlwares/authorizeRoles")
const Certification = require("../models/certificat"); // import du modèle

// afficher
router.get("/", async (req, res) => {
  try {
    const quizzes = await Quiz.find().populate("cours", "nomCours")
    res.status(200).json(quizzes)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// ajouter
// Dans votre fichier de routes (quizRoutes.js)
router.post(
  '/',
  verifyToken,
  authorizeRoles('enseignant'),
  async (req, res) => {
    try {
      const { title, descriptionquiz, questions, cours: courseId, chapterId, timeLimit, passingScore, isFinalTest } = req.body;

      console.log('Données reçues :', req.body); // Log pour déboguer

      if (!title || !descriptionquiz || !questions || !courseId || !timeLimit || !passingScore || !chapterId) {
        return res.status(400).json({ message: 'Données manquantes, chapterId requis' });
      }

      const cours = await Cours.findById(courseId);
      if (!cours) {
        return res.status(404).json({ message: 'Cours non trouvé' });
      }

      if (chapterId) {
        const chapter = cours.contenu.id(chapterId);
        if (!chapter) {
          return res.status(404).json({ message: 'Chapitre non trouvé dans ce cours' });
        }
      }

      const newQuiz = new Quiz({
        title,
        descriptionquiz,
        questions,
        cours: courseId,
        chapterId, // Pas de || null ici, car chapterId est requis
        timeLimit,
        passingScore,
        isFinalTest,
        enseignantId: req.user.id,
      });

      await newQuiz.save();

      return res.status(201).json({
        message: 'Quiz créé avec succès',
        quiz: newQuiz.toObject({ virtuals: true }),
      });
    } catch (error) {
      console.error('Erreur création quiz :', error);
      return res.status(500).json({ message: error.message });
    }
  }
);
router.get('/chapter/:chapterId', async (req, res) => {
  try {
    const quizzes = await Quiz.find({ chapterId: req.params.chapterId });
    return res.status(200).json(quizzes);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});
// affiche par id
router.get("/:id", async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate("cours", "nomCours")
    if (!quiz) return res.status(404).json({ message: "Quiz non trouvé" })
    res.status(200).json(quiz)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})
// GET tous les quiz d'un cours
router.get('/cours/:coursId', async (req, res) => {
  try {
    const quizzes = await Quiz.find({ cours: req.params.coursId });
    return res.status(200).json(quizzes);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});


//modifier
router.put("/:id", async (req, res) => {
  try {
    const updatedQuiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!updatedQuiz) return res.status(404).json({ message: "Quiz non trouvé" })
    res.status(200).json(updatedQuiz)
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

// supprimer
router.delete("/:id", verifyToken, authorizeRoles('enseignant'), async (req, res) => {
  try {
    const deletedQuiz = await Quiz.findByIdAndDelete(req.params.id);
    if (!deletedQuiz) return res.status(404).json({ message: "Quiz non trouvé" });

    // Vérifier si le quiz supprimé est un test final
    if (deletedQuiz.isFinalTest) {
      // Supprimer la référence finalTest dans le document Cours
      await Cours.updateOne(
        { finalTest: deletedQuiz._id },
        { $unset: { finalTest: 1 } }
      );
    }

    res.status(200).json({ message: "Quiz supprimé avec succès" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// soumission unique pour tous les quizzes (normaux ou finals)
router.post('/:id/submit', verifyToken, async (req, res) => {
  try {
    const { reponses } = req.body;
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      console.log('Quiz not found:', req.params.id);
      return res.status(404).json({ message: 'Quiz non trouvé' });
    }
    console.log('Quiz found:', quiz._id, 'Course:', quiz.cours);

    const etudiant = await Etudiant.findOne({ userId: req.user.id });
    if (!etudiant) {
      console.log('Student not found for user:', req.user.id);
      return res.status(404).json({ message: 'Étudiant non trouvé' });
    }
    console.log('Student found:', etudiant._id);

    const quizDejaReussi = etudiant.quizzesReussis.some(q => q.quizId.equals(quiz._id));
    if (quizDejaReussi) {
      console.log('Quiz already passed:', quiz._id);
      return res.status(403).json({ message: 'Vous avez déjà réussi ce test final.', alreadyPassed: true });
    }

    let nombreCorrect = 0;
    const totalQuestions = quiz.questions.length;

    quiz.questions.forEach((question, idx) => {
      const correctIndex = question.options.findIndex(opt => opt.isCorrect);
      if (reponses[idx] === correctIndex) {
        nombreCorrect += 1;
      }
    });

    const pourcentage = (nombreCorrect / totalQuestions) * 100;
    const passed = pourcentage >= quiz.passingScore;
    const pointsObtenus = nombreCorrect * 10;

    if (passed) {
      etudiant.quizzesReussis.push({ quizId: quiz._id, pointsObtenus });
      etudiant.points += pointsObtenus;

      const existingCert = await Certification.findOne({ etudiant: etudiant._id, cours: quiz.cours });
      if (!existingCert) {
        console.log('Creating certification for course:', quiz.cours, 'student:', etudiant._id);
        const certificate = new Certification({
          etudiant: etudiant._id,
          cours: quiz.cours,
          finalScore: pourcentage,
          issueDate: new Date(),
          verificationCode: require('crypto').randomBytes(8).toString('hex'),
        });
        await certificate.save();
        console.log('Certification created:', certificate._id);
        etudiant.certifications.push(certificate._id);
      } else {
        console.log('Certification already exists:', existingCert._id);
      }

      await etudiant.save();
      console.log('Student updated with quiz and certification');
    }

    res.status(200).json({ score: pourcentage, passed, pointsObtenus });
  } catch (error) {
    console.error('Error in submit-final:', error);
    res.status(500).json({ message: error.message });
  }
});
// ### Backend: routes/etudiantRoutes.js (new route) ###

// Retourne les quizzes réussis pour un étudiant
router.get('/:userId/quizzes-reussis', async (req, res) => {
  try {
    const etudiant = await Etudiant.findOne({ userId: req.params.userId })
      .populate('quizzesReussis.quizId', 'title passingScore');
    if (!etudiant) return res.status(404).json({ message: 'Étudiant non trouvé' });
    console.log('Quizzes réussis renvoyés :', etudiant.quizzesReussis); // Log pour vérifier
    res.json(etudiant.quizzesReussis);
  } catch (error) {
    console.error('Erreur dans GET /quizzes-reussis :', error);
    res.status(500).json({ message: error.message });
  }
});
// GET /cours/:coursId/final-test
// back-end (quizRoutes.js)
// GET /api/quizzes/cours/:coursId/final-test
// quizRoutes.js
router.get(
  '/cours/:coursId/final-test',
  verifyToken,           // pour récupérer l’utilisateur connecté
  async (req, res) => {
    try {
      // 1) Récupérer le cours et son finalTest
      const cours = await Cours.findById(req.params.coursId).populate('finalTest');
      if (!cours || !cours.finalTest) {
        return res.status(404).json({ message: 'Pas de test final pour ce cours' });
      }

      // 2) Récupérer l’étudiant et son historique de quiz réussis
      const etudiant = await Etudiant.findOne({ userId: req.user.id });
      if (!etudiant) {
        return res.status(404).json({ message: 'Étudiant non trouvé' });
      }

      // 3) Vérifier si le finalTest._id est déjà dans quizzesReussis
      const alreadyPassed = etudiant.quizzesReussis.some(q =>
        q.quizId.equals(cours.finalTest._id)
      );

      // 4) Répondre en même temps avec le quiz et le flag
      return res.json({
        test: cours.finalTest,
        alreadyPassed
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: err.message });
    }
  }
);
// juste après votre GET /cours/:coursId/final-test
// Route dédiée à l'enseignant pour récupérer son test final
router.get(
  '/cours/:coursId/teacher-final-test',
  verifyToken,
  authorizeRoles('enseignant'),
  async (req, res) => {
    try {
      // 1) Récupérer le cours et peupler finalTest
      const cours = await Cours.findById(req.params.coursId).populate('finalTest');
      if (!cours) return res.status(404).json({ message: 'Cours non trouvé' });
      if (!cours.finalTest) return res.status(404).json({ message: 'Pas de test final pour ce cours' });

      // 2) Renvoi du quiz final complet
      res.status(200).json(cours.finalTest);
    } catch (err) {
      console.error('Erreur teacher-final-test:', err);
      res.status(500).json({ message: err.message });
    }
  }
);



// quizRoutes.js

// Créer un test final pour un cours et l'attacher au document Cours
router.post('/final/:coursId', verifyToken, authorizeRoles('enseignant'), async (req, res) => {
  try {
    const { coursId } = req.params;
    const cours = await Cours.findById(coursId);
    if (!cours) return res.status(404).json({ message: 'Cours non trouvé' });

    // Création du quiz final sans chapterId
    const quizData = { ...req.body, cours: coursId, isFinalTest: true, chapterId: null };
    const finalQuiz = await Quiz.create(quizData);

    // Mise à jour du cours avec le test final
    const updatedCours = await Cours.findByIdAndUpdate(
      coursId,
      { finalTest: finalQuiz._id },
      { new: true, runValidators: true }
    );

    return res.status(201).json(finalQuiz);
  } catch (err) {
    console.error('Erreur complète :', err.stack);
    return res.status(500).json({ message: err.message });
  }
});

router.post('/:id/submit-final', verifyToken, async (req, res) => {
  try {
    const { reponses } = req.body;
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz non trouvé' });

    const etudiant = await Etudiant.findOne({ userId: req.user.id });
    if (!etudiant) return res.status(404).json({ message: 'Étudiant non trouvé' });

    // Vérifier si c'est déjà un test final réussi
    const dejaPasse = etudiant.finalTestsReussis.some(f =>
      f.testId.equals(quiz._id)
    );
    if (dejaPasse) {
      return res.status(403).json({ message: 'Test final déjà réussi.' });
    }

    // Calcul du score
    let nombreCorrect = 0;
    quiz.questions.forEach((q, idx) => {
      const idxCorrect = q.options.findIndex(o => o.isCorrect);
      if (reponses[idx] === idxCorrect) nombreCorrect++;
    });
    const pourcentage = (nombreCorrect / quiz.questions.length) * 100;
    const passed = pourcentage >= quiz.passingScore;
    const pointsObtenus = nombreCorrect * 10;

    if (passed) {
      // On garde aussi l’historique des quizzes “normaux”
      etudiant.quizzesReussis.push({ quizId: quiz._id, pointsObtenus });
      etudiant.points += pointsObtenus;

      // **NOUVEAU** on ajoute le test final réussi
      etudiant.finalTestsReussis.push({
        testId: quiz._id,
        score: pourcentage,
        // dateReussite sera à Date.now() par défaut
      });

      // Création de la certification si besoin
      const existingCert = await Certification.findOne({ etudiant: etudiant._id, cours: quiz.cours });
      if (!existingCert) {
        const certificate = new Certification({
          etudiant: etudiant._id,
          cours: quiz.cours,
          finalScore: pourcentage,
          issueDate: new Date(),
          verificationCode: require('crypto').randomBytes(8).toString('hex'),
        });
        await certificate.save();
        etudiant.certifications.push(certificate._id);
      }

      await etudiant.save();
    }

    res.status(200).json({ score: pourcentage, passed, pointsObtenus });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});
// GET /api/etudiants/:userId/final-tests
router.get('/etudiants/:userId/final-tests', async (req, res) => {
  try {
    const etu = await Etudiant
      .findOne({ userId: req.params.userId })
      .populate('finalTestsReussis.testId', 'title passingScore');
    if (!etu) return res.status(404).json({ message: 'Étudiant non trouvé' });
    res.json(etu.finalTestsReussis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});
// Delete a specific question from a quiz
router.delete('/:quizId/questions/:questionIndex', verifyToken, authorizeRoles('enseignant'), async (req, res) => {
  try {
    const { quizId, questionIndex } = req.params;

    // Find the quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ message: 'Quiz non trouvé' });

    // Check if questionIndex is valid
    if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
      return res.status(400).json({ message: 'Index de question invalide' });
    }

    // Remove the question at the specified index
    quiz.questions.splice(questionIndex, 1);

    // Save the updated quiz
    await quiz.save();

    res.status(200).json({ message: 'Question supprimée avec succès', quiz });
  } catch (error) {
    console.error('Erreur lors de la suppression de la question :', error);
    res.status(500).json({ message: error.message });
  }
});// Edit a specific question in a quiz
router.patch('/:quizId/questions/:questionIndex', verifyToken, authorizeRoles('enseignant'), async (req, res) => {
  try {
    const { quizId, questionIndex } = req.params;
    const { question, options } = req.body;

    // Find the quiz
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ message: 'Quiz non trouvé' });

    // Check if questionIndex is valid
    if (questionIndex < 0 || questionIndex >= quiz.questions.length) {
      return res.status(400).json({ message: 'Index de question invalide' });
    }

    // Update the question
    quiz.questions[questionIndex] = {
      ...quiz.questions[questionIndex],
      question: question || quiz.questions[questionIndex].question,
      options: options || quiz.questions[questionIndex].options,
    };

    // Save the updated quiz
    await quiz.save();

    res.status(200).json({ message: 'Question modifiée avec succès', quiz });
  } catch (error) {
    console.error('Erreur lors de la modification de la question :', error);
    res.status(500).json({ message: error.message });
  }
});
router.post(
  "/:quizId/questions",
  verifyToken,
  authorizeRoles("enseignant"),
  async (req, res) => {
    try {
      const { quizId } = req.params;
      const newQuestion = req.body;

      // Trouver le quiz
      const quiz = await Quiz.findById(quizId);
      if (!quiz) return res.status(404).json({ message: "Quiz non trouvé" });

      // Ajouter la nouvelle question
      quiz.questions.push(newQuestion);

      // Sauvegarder le quiz mis à jour
      await quiz.save();

      res.status(201).json({ message: "Question ajoutée avec succès", quiz });
    } catch (error) {
      console.error("Erreur lors de l'ajout de la question :", error);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router
