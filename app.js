const express = require('express')
const mongoose = require('mongoose')
const cors = require("cors")
const dotenv = require('dotenv')
const filiereRouter = require('./routes/filiere.route')
const coursRouter = require('./routes/cours.route')
const userRouter = require("./routes/user.route")
const profileRouter = require("./routes/profile.route")
const quizRouter = require ('./routes/quiz.route')
const certificatRouter = require('./routes/certificat.route');
const forumRouter = require('./routes/forum.route');
const sousFilieresRouter = require('./routes/sousfiliere.route')
const newsletterRouter = require('./routes/newsletter.route');
const contactRouter = require('./routes/contact.route');
const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
dotenv.config()
app.use(cors())
app.get('/',(req,res)=>{
    res.send('Bienvenue sur notre site')
})
// connexion base de donnée

mongoose.connect(process.env.DATABASECLOUD)
.then(()=>{console.log("connexion reussie" )})
.catch(()=>{console.log("Impossibl",error) ;
    process.exit()
})

app.use("/api/filiere",filiereRouter)
app.use("/api/cours",coursRouter)
app.use("/api/users", userRouter,profileRouter);
app.use("/api/quizzes" , quizRouter)
app.use('/api/certificats', certificatRouter);
app.use('/api/forum', forumRouter);
app.use('/api/sous-filieres', sousFilieresRouter)
app.use("/api/newsletter", newsletterRouter);
app.use('/api/contact', contactRouter);

app.listen(4000,()=>{
    console.log(`Serveur is listen on port ${process.env.PORT}`)
})
module.exports=app ;

