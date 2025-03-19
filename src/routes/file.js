const express = require("express");
const router = express.Router();
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const s3 = require("../config/s3");
const File = require("../models/file");

const upload = multer({ storage: multer.memoryStorage() });


// POST /v1/file
router.post("/", upload.single("profilePic"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const userId = uuidv4();
    const fileExtension = path.extname(req.file.originalname);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const s3Key = `${userId}/${uniqueFileName}`;

    const uploadParams = {
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };
    await s3.upload(uploadParams).promise();

    // Store metadata in DB
    const fileRecord = await File.create({
      user_id: userId,
      file_name: req.file.originalname,
      url: `${process.env.S3_BUCKET}/${s3Key}`,
      upload_date: new Date().toISOString().split("T")[0],
    });

    return res.status(201).json({
      file_name: fileRecord.file_name,
      id: userId,
      url: fileRecord.url,
      upload_date: fileRecord.upload_date,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return res.status(500).json({ error: "Error uploading file" });
  }
});


// GET /v1/file/:id
router.get("/:id", async (req, res) => {
  try {
    const fileRecord = await File.findOne({ where: { user_id: req.params.id } });

    if (!fileRecord) {
      return res.status(404).json({ error: "File not found" });
    }

    return res.status(200).json({
      file_name: fileRecord.file_name,
      id: fileRecord.user_id,
      url: fileRecord.url,
      upload_date: fileRecord.upload_date,
    });
  } catch (error) {
    console.error("Error retrieving file:", error);
    return res.status(500).json({ error: "Error retrieving file" });
  }
});

//  DELETE /v1/file/:id
router.delete("/:id", async (req, res) => {
  try {
    const fileRecord = await File.findOne({ where: { user_id: req.params.id } });

    if (!fileRecord) {
      return res.status(404).json({ error: "File not found" });
    }

    // Delete from S3
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET,
        Key: fileRecord.url.replace(`${process.env.S3_BUCKET}/`, ""),
      })
      .promise();

    // Remove from DB
    await fileRecord.destroy();

    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting file:", error);
    return res.status(500).json({ error: "Error deleting file" });
  }
});

// Handle unsupported methods
router.all("/", (req, res) => res.status(405).json({ error: "Method Not Allowed" }));
router.all("/:id", (req, res) => res.status(405).json({ error: "Method Not Allowed" }));

module.exports = router;
