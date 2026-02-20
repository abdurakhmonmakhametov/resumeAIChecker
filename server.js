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


// ✅ Absolute uploads path (Railway safe)

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}


// ✅ Multer storage

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }

});


const upload = multer({

    storage,

    fileFilter: (req, file, cb) => {

        if (file.mimetype === "application/pdf") {

            cb(null, true);

        } else {

            cb(new Error("Only PDF allowed"));

        }

    }

});


// ✅ OpenAI client

const openai = new OpenAI({

    apiKey: process.env.OPENAI_API_KEY

});


// ✅ Health route

app.get("/", (req, res) => {

    res.send("ATS Analyzer Backend Working");

});


// ✅ Main analyze route

app.post("/analyze", upload.single("cv"), async (req, res) => {

    try {

        if (!req.file) {

            return res.status(400).json({

                error: true,
                message: "No file uploaded"

            });

        }


        // upload file to OpenAI

        const uploadedFile = await openai.files.create({

            file: fs.createReadStream(req.file.path),

            purpose: "user_data"

        });



        // ✅ FIXED JSON FORMAT PROMPT

        const response = await openai.responses.create({

            model: "gpt-5.2",

            text: {
                format: { type: "json_object" }
            },

            input: [

                {

                    role: "user",

                    content: [

                        {

                            type: "input_text",

                            text: `


Analyze this resume like a modern ATS system BUT be FAIR, REALISTIC and SLIGHTLY POSITIVE.

Important scoring rules:

• Most resumes should score between 70 and 90
• Only very bad resumes below 60
• Only exceptional resumes above 90

Do NOT be overly strict.

Focus on:

• structure
• readability
• skills
• clarity
• completeness

Return ONLY valid JSON:

{
"ats_score": number,
"message": string,
"status": "Tayor" or "Hali Tayor emas!",
"weaknesses": string[],
"improvements": string[]
}

Status rules:

If ats_score >= 70:
message: "Ajoyib! Sizning resumeyiz ishga tayor."
status: "Tayor"

If ats_score < 70:
message: "Resumeyiz hali tayor emas."
status: "Hali Tayor emas!"

Weaknesses:
• maximum 3 items
• keep simple
• do NOT be harsh

Improvements:
• maximum 4 items
• keep simple
• practical advice

Be supportive, professional and balanced.

`

                        },

                        {

                            type: "input_file",
                            file_id: uploadedFile.id

                        }

                    ]

                }

            ]

        });



        // safe read

        const text =
            response.output?.[0]?.content?.[0]?.text || "{}";


        const result = JSON.parse(text);


        res.json(result);


        // cleanup

        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }


    }

    catch (e) {

        console.log(e);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({

            error: true,
            message: e.message

        });

    }

});


// ✅ Railway-safe listen

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

    console.log("Server running on port " + PORT);

});
