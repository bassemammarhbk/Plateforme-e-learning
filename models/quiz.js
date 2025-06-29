const mongoose = require("mongoose")

const QuizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Veuillez fournir un titre pour le quiz"],
    trim: true,
    maxlength: [100, "Le titre ne peut pas dépasser 100 caractères"],
  },
  descriptionquiz: {
    type: String,
    required: [true, "Veuillez fournir une description pour le quiz"],
  },
  cours: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cours",
  },
  isFinalTest: {
    type: Boolean,
    default: false,
  },
  chapterId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  questions: [
    {
      question: {
        type: String,
        required: true,
      },
      options: [
        {
          text: {
            type: String,
            required: true,
          },
          isCorrect: {
            type: Boolean,
            required: true,
          },
        },
      ],
      points: {
        type: Number,
        default: 1,
      },
    },
  ],

  timeLimit: {
    type: Number, // en minutes
    default: 30,
  },
  passingScore: {
    type: Number,
    default: 70, // pourcentage
  }
},
  { timestamps: true }
)

module.exports = mongoose.model("Quiz", QuizSchema)
