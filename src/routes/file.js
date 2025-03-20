const express = require("express");
const router = express.Router();
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const s3 = require("../config/s3");
const File = require("../models/file");

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

// POST /v1/file
router.post("/", upload.single("profilePic"), async (req, res) => {
  try {
    if (!process.env.S3_BUCKET) {
      return res.status(500).send(); // No body for server errors
    }
    if (!req.file) {
      return res.status(400).send(); // No body for bad request
    }

    const userId = uuidv4();
    const fileExtension = path.extname(req.file.originalname);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const s3Key = `${userId}/${uniqueFileName}`;

    // Upload to S3
    await s3.upload({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }).promise();

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
    return res.status(500).send();
  }
});

// GET /v1/file/:id
router.get("/:id", async (req, res) => {
  try {
    const fileRecord = await File.findOne({ where: { user_id: req.params.id } });
    if (!fileRecord) {
      return res.status(404).send();
    }
    return res.status(200).json({
      file_name: fileRecord.file_name,
      id: fileRecord.user_id,
      url: fileRecord.url,
      upload_date: fileRecord.upload_date,
    });
  } catch (error) {
    console.error("Error retrieving file:", error);
    return res.status(500).send();
  }
});

// DELETE /v1/file
router.delete("/", (req, res) => {
  return res.status(400).send();
});

// DELETE /v1/file/:id
router.delete("/:id", async (req, res) => {
  try {
    const fileRecord = await File.findOne({ where: { user_id: req.params.id } });
    if (!fileRecord) {
      return res.status(404).send();
    }

    // Delete from S3
    await s3.deleteObject({
      Bucket: process.env.S3_BUCKET,
      Key: fileRecord.url.replace(`${process.env.S3_BUCKET}/`, ""),
    }).promise();

    // Remove from DB
    await fileRecord.destroy();
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting file:", error);
    return res.status(500).send();
  }
});

// Explicitly disallow POST on /v1/file/:id
router.post("/:id", (req, res) => res.status(405).send());

// Handle other unsupported methods on / and /:id
router.all("/", (req, res) => res.status(405).send());
router.all("/:id", (req, res) => res.status(405).send());

module.exports = router;
