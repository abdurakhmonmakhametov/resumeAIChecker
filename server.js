require("dotenv").config();

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const OpenAI = require("openai");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());


// ✅ ensure uploads folder exists

if (!fs.existsSync("uploads")) {
fs.mkdirSync("uploads");
}



// storage

const storage = multer.diskStorage({

destination: (req,file,cb)=>{
cb(null,"uploads/");
},

filename: (req,file,cb)=>{
cb(null, Date.now() + path.extname(file.originalname));
}

});


const upload = multer({

storage,

fileFilter:(req,file,cb)=>{

if(file.mimetype==="application/pdf"){

cb(null,true);

}else{

cb(new Error("Only PDF allowed"));

}

}

});


const openai = new OpenAI({

apiKey: process.env.OPENAI_API_KEY

});



app.get("/", (req,res)=>{

res.send("ATS Analyzer Backend Working");

});



app.post("/analyze", upload.single("cv"), async (req,res)=>{

try{


if(!req.file){

return res.status(400).json({

error:true,

message:"No file uploaded"

});

}



const uploadedFile =
await openai.files.create({

file: fs.createReadStream(req.file.path),

purpose:"user_data"

});



const response =
await openai.responses.create({

model:"gpt-5.2",

response_format:{type:"json_object"},


input:[

{

role:"user",

content:[

{

type:"input_text",

text:`

Analyze resume and return:

{

ats_score:number,

message:string,

status:string,

weaknesses:string[],

improvements:string[]

}

ATS 0-100

>=70 ready

<70 not ready

`

},

{

type:"input_file",

file_id: uploadedFile.id

}

]

}

]

});



const text =
response.output?.[0]?.content?.[0]?.text || "{}";


const result = JSON.parse(text);


res.json(result);


fs.unlinkSync(req.file.path);



}catch(e){

console.log(e);

if(req.file){
fs.unlinkSync(req.file.path);
}

res.status(500).json({

error:true,

message:e.message

});

}

});



app.listen(3000, ()=>{

console.log("Server running on http://localhost:3000");

});
