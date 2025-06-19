// const mongoose = require('mongoose');
// const env = require('dotenv').config();

// const connectDB = async()=>{
//     try{

//        await mongoose.connect(process.env.MONGODB_URI);
//         console.log('DB Connected Succesfully')
//     }catch(error){
//         console.log('DB Connection error',error.message);
//         process.exit(1);
//     }
// }

// module.exports = connectDB;

const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log('✅ MongoDB Atlas Connected Successfully');
  } catch (error) {
    console.error('❌ MongoDB Atlas Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;   
      