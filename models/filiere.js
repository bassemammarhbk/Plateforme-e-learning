const mongoose = require ('mongoose')
const filiereSchema = new mongoose.Schema({
    nomfiliere : {
        type : String , required : true , unique : true
    },
    imagefiliere : {
        type : String , required : false
    },
    descriptionfiliere : {
        type : String , required : false
    }
    } ,
    { timestamps: true }
)
module.exports = mongoose.model('Filiere',filiereSchema)