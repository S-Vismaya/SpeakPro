const express = require("express");
const cors = require("cors");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();

const app = express();

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: process.env.SQLPASSWD,
  database: "prosody"
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database: ' + err.message);
  } else {
    console.log('Connected to the database');
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, "uploads");
const audioDir = path.join(__dirname, "model/audio_files");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post("/upload-video/:email", upload.single("video"), async (req, res) => {
  try {
    console.log("Received video upload request");
    const user_id = req.params.email;
    const videoBlob = req.file.buffer;
    const timestamp = Date.now();
    const videoFileName = `video_${timestamp}.webm`;
    const videoFilePath = path.join(uploadsDir, videoFileName);
    fs.writeFileSync(videoFilePath, videoBlob);
    const wavFileName = `audio_${timestamp}.wav`;
    const wavFilePath = path.join(audioDir, wavFileName);
    console.log("WAV file started:", wavFilePath);

    ffmpeg(videoFilePath)
      .output(wavFilePath)
      .on("end", async () => {
        console.log("WAV file created:", wavFilePath);

        const pythonProcess = spawn("python3", [
          "./model/test.py",
          wavFileName,
          videoFileName,
        ]);

        let parsedData = await new Promise((resolve, reject) => {
          let dataChunks = [];
          pythonProcess.stdout.on("data", (data) => {
            dataChunks.push(data);
          });

          pythonProcess.stdout.on("end", () => {
            const dataString = Buffer.concat(dataChunks).toString();
            console.log("datastring", dataString);
            console.log("end datastring");
            const lines = dataString.split("\n");
            
            let parsedData = {
              articulationDatapoints: [],
              pausesDatapoints: [],
              overallBalance: null,
              totalNumberOfPauses: null,
              transcription: "",
              fillerWords: [],
              repeats: [],
              stutter: [],
              likes: [],
            };

            // Parsing the data here
            parsedData["articulationDatapoints"] = JSON.parse(lines[0]);
            parsedData["pausesDatapoints"] = JSON.parse(lines[1]);
            parsedData["overallBalance"] = parseFloat(lines[2].split(": ")[1]);
            parsedData["totalNumberOfPauses"] = parseFloat(
              lines[3].split(": ")[1]
            );

            let i = 4;
            while (lines[i][0] === "[") {
              i++;
            }
            parsedData["transcription"] = lines[i].split(": ")[1];
            let valid_json_str = lines[i + 1].replace(/'/g, '"');
            let input_data = JSON.parse(valid_json_str);
            parsedData["fillerWords"] = input_data.map(([word, time]) => ({
              word,
              time,
            }));
            valid_json_str = lines[i + 2].replace(/'/g, '"');
            input_data = JSON.parse(valid_json_str);
            parsedData["repeats"] = input_data.map(([word, time]) => ({
              word,
              time,
            }));
            valid_json_str = lines[i + 3].replace(/'/g, '"');
            input_data = JSON.parse(valid_json_str);
            parsedData["stutter"] = input_data.map(([word, time]) => ({
              word,
              time,
            }));
            valid_json_str = lines[i + 4].replace(/'/g, '"');
            input_data = JSON.parse(valid_json_str);
            parsedData["likes"] = input_data.map(([word, time]) => ({
              word,
              time,
            }));
            console.log(lines);
            parsedData["eyeContactPenalty"] = parseFloat(lines[i + 5]);
            parsedData["FinalScore"] = parseFloat(lines[i + 6]);

            input_data = JSON.parse(valid_json_str);

            console.log(parsedData);
            resolve(parsedData);
          });

          pythonProcess.on("error", (err) => {
            reject(err);
          });
        });
        const insertVideoQuery = `INSERT INTO videos (metadata, filepath) VALUES (?, ?)`;
    const videoValues = [JSON.stringify(parsedData), videoFilePath]; // Replace 'some_user_id' with actual user ID

    connection.query(insertVideoQuery, videoValues, (err, videoResult) => {
      if (err) {
        console.error('Error inserting video into database:', err);
        return res.status(500).send('Error inserting video into database');
      }

      const videoId = videoResult.insertId;
      const timestamp = new Date();

      // Insert into scores table
      const insertScoresQuery = `INSERT INTO scores (user_id, score, timestamp, video_id) VALUES (?, ?, ?, ?)`;
      const scoresValues = [user_id, parsedData['FinalScore'], timestamp, videoId];

      connection.query(insertScoresQuery, scoresValues, (err, scoresResult) => {
        if (err) {
          console.error('Error inserting scores into database:', err);
          return res.status(500).send('Error inserting scores into database');
        }

        // Optionally, add the score ID to the parsedData object
        parsedData.scoreId = scoresResult.insertId;

        res.status(200).send(parsedData);
      });
    });
      })
      .on("error", (err) => {
        console.error("Error creating WAV file:", err);
        res.status(500).send("Error creating WAV file");
      })
      .run();
  } catch (error) {
    console.error("Error uploading video:", error);
    if (!res.headersSent) {
      res.status(500).send("Error uploading video");
    }
  }
});

app.get("/getscores/:user_id", (req, res) => {
  const user_id = req.params.user_id;
  connection.query(
    `SELECT * FROM scores WHERE user_id = '${user_id}'`,
    (err, rows, fields) => {
      if (err) {
        console.log(err);
        res.status(500).send("Error in query");
      } else {
        console.log("Successful query");
        res.status(200).send(rows);
      }
    }
  );
});

app.get("/getvideo/:video_id", (req, res) => {
  const video_id = req.params.video_id;
  connection.query(
    `SELECT * FROM videos WHERE id = ${video_id}`,
    (err, rows, fields) => {
      if (err) {
        console.log(err);
        res.status(500).send("Error in query");
      } else {
        if (rows.length === 0) {
          res.status(404).send('Video not found');
        } else {
          const filepath = rows[0].filepath;
          res.type('video/webm')
          res.sendFile(filepath);
        }
      }
    }
  );
});

app.get("/getdata/:video_id", (req, res) => {
  const video_id = req.params.video_id;
  connection.query(
    `SELECT * FROM videos WHERE id = ${video_id}`,
    (err, rows, fields) => {
      if (err) {
        console.log(err);
        res.status(500).send("Error in query");
      } else {
        if (rows.length === 0) {
          res.status(404).send('Video not found');
        } else {
          res.send(rows[0].metadata);
        }
      }
    }
  );
});

app.post("/login/:email", (req, res) => {
  const email = req.params.email;
  connection.query(
    `SELECT * FROM users WHERE user_id = '${email}'`,
    (err, rows, fields) => {
      if (err) {
        console.log("Error in query");
        res.status(500).send("Error in query");
      } else {
        if (rows.length === 0) {
          // If user_id not found, insert a new row
          connection.query(
            `INSERT INTO users (user_id) VALUES ('${email}')`,
            (insertErr, insertResult) => {
              if (insertErr) {
                console.log("Error inserting new user");
                res.status(500).send("Error inserting new user");
              } else {
                // User added successfully, you can return a success response
                res.status(200).send({ message: 'New user created' });
              }
            }
          );
        } else {
          // User found, send the user data
          res.status(200).send(rows[0]);
        }
      }
    }
  );
});

const today = new Date().toISOString().slice(0, 10);

app.get("/getleaderboard", (req, res) => {
  connection.query(
    `SELECT user_id, score FROM scores 
     WHERE DATE(timestamp) = ?
     ORDER BY score DESC 
     LIMIT 10`,
    [today],
    (err, rows, fields) => {
      if (err) {
        console.log(err);
        res.status(500).send("Error in query");
      } else {
        console.log("Successful query");
        res.status(200).send(rows);
      }
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));