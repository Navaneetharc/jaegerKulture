const mongoose = require('mongoose');
const {Schema} = mongoose;

const animeSchema = new Schema({
    animeName:{
        type:String,
        required:true
    },
    animeImage:{
        type: [String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    createdAt:{
        type:Date,
        default:Date.now
    }
})

const Anime = mongoose.model("Anime",animeSchema);
module.exports = Anime;