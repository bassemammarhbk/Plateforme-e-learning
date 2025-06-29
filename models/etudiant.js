const mongoose = require ('mongoose')
const etudiantSchema = mongoose.Schema({
    userId :{
        type : mongoose.Schema.Types.ObjectId , ref : 'User'
    },
    coursInscri: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cours' }],
    certifications: [
        {
          type: mongoose.Schema.Types.ObjectId, ref: 'Certification'
        }
      ],
    points: {
        type: Number,
        default: 0
      },
      quizzesReussis: [
        {
          quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
          pointsObtenus: { type: Number },
        },
      ],
      chapitresCompletes: [
        {
          coursId:   {
             type: mongoose.Schema.Types.ObjectId, ref: 'Cours'
            },
          chapitreId:{
             type: mongoose.Schema.Types.ObjectId
            }
        }
      ],
     finalTestsReussis: [
    {
      testId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
      },
      score: {
        type: Number,
        required: true
      },
      dateReussite: {
        type: Date,
        default: Date.now
      }
    }
  ],
},
    {timestamps: true }
)

module.exports = mongoose.model('Etudiant',etudiantSchema)