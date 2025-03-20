const express = require("express");
const router = express.Router();
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const s3 = require("../config/s3");
const File = require("../models/file");

// Configure multer for in-memory storage, limit file size to 5MB, only allow images
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

// POST /v1/file
// - Must use field name "profilePic"
// - Rejects query params or invalid files with 400
router.post(
  "/",
  (req, res, next) => {
    // Immediately reject if any query parameters exist or auth headers present
    if (
      Object.keys(req.query).length > 0 ||
      req.get("authentication") ||
      req.get("authorization")
    ) {
      return res.status(400).send(); // empty body
    }
    next();
  },
  (req, res, next) => {
    // Use multer to parse a single file with field name "profilePic"
    const singleUpload = upload.single("profilePic");

    singleUpload(req, res, function (err) {
      if (err) {
        // Wrong field name or multiple files
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).send();
        }
        // Non-image file
        if (err.message === "Only image files are allowed") {
          return res.status(400).send();
        }
        // File too large (exceeds 5MB)
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).send(); 
        }
        // Any other Multer error
        console.error("Multer error:", err);
        return res.status(400).send();
      }
      // If no file was uploaded at all
      if (!req.file) {
        return res.status(400).send();
      }

      next();
    });
  },
  async (req, res) => {
    try {
      if (!process.env.S3_BUCKET) {
        return res.status(400).send(); 
      }

      // Generate IDs and file paths
      const userId = uuidv4();
      const fileExtension = path.extname(req.file.originalname);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const s3Key = `${userId}/${uniqueFileName}`;

      // Upload to S3
      await s3
        .upload({
          Bucket: process.env.S3_BUCKET,
          Key: s3Key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
        .promise();


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
      return res.status(400).send(); 
    }
  }
);

router.head("/", (req, res) => {
  return res.status(405).send(); 
});

router.head("/:id", (req, res) => {
  return res.status(405).send(); 
});

// GET /v1/file/:id
// - Return 200 + JSON if found, 404 if not found, 500 on error
// GET /v1/file/:id
router.get("/:id", async (req, res) => {
  if (
    Object.keys(req.query).length > 0 ||
    Object.keys(req.body).length > 0 ||
    req.get("authentication") ||
    req.get("authorization")
  ) {
    return res.status(400).send(); 
  }

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
    return res.status(404).send(); // empty body
  }
});


// DELETE /v1/file => 400 (no id provided)
router.delete("/", (req, res) => {
  return res.status(400).send(); 
});

// DELETE /v1/file/:id
// - Return 204 on success, 404 if not found, 500 on error
router.delete("/:id", async (req, res) => {
  try {
    const fileRecord = await File.findOne({ where: { user_id: req.params.id } });
    if (!fileRecord) {
      return res.status(404).send();
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
    if (error.message && error.message.includes("does not exist")) {
      console.error("It looks like the 'File' table might not be created. Ensure DB sync is done.");
    }
    console.error("Error deleting file:", error);
    return res.status(404).send(); 
  }
});

// For all other methods on /v1/file => 405 (empty body)
router.get("/", (req, res) => res.status(400).send());
router.delete("/", (req, res) => res.status(400).send());
router.all("/", (req, res) => res.status(405).send());

// For all other methods on /v1/file/:id => 405 (empty body)
router.all("/:id", (req, res) => res.status(405).send());

module.exports = router;
