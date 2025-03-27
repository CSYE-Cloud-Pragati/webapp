const express = require("express");
const router = express.Router();
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const s3 = require("../config/s3");
const File = require("../models/file");

// Import the Winston logger
const logger = require("../config/logger");
// Import the StatsD metrics client (NEW for metrics)
const metrics = require("../config/metrics");

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
    logger.info("POST /v1/file: Checking for query params or auth headers");
    // Immediately reject if any query parameters exist or auth headers present
    if (
      Object.keys(req.query).length > 0 ||
      req.get("authentication") ||
      req.get("authorization")
    ) {
      logger.warn("POST /v1/file: Rejected - query params or auth headers present");
      return res.status(400).send(); // empty body
    }
    next();
  },
  (req, res, next) => {
    logger.info("POST /v1/file: Handling file upload via Multer");
    // Use multer to parse a single file with field name "profilePic"
    const singleUpload = upload.single("profilePic");

    singleUpload(req, res, function (err) {
      if (err) {
        // Wrong field name or multiple files
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          logger.warn("POST /v1/file: Rejected - unexpected file field");
          return res.status(400).send();
        }
        // Non-image file
        if (err.message === "Only image files are allowed") {
          logger.warn("POST /v1/file: Rejected - non-image file");
          return res.status(400).send();
        }
        // File too large (exceeds 5MB)
        if (err.code === "LIMIT_FILE_SIZE") {
          logger.warn("POST /v1/file: Rejected - file too large");
          return res.status(400).send();
        }
        // Any other Multer error
        logger.error("POST /v1/file: Multer error:", err);
        return res.status(400).send();
      }
      // If no file was uploaded at all
      if (!req.file) {
        logger.warn("POST /v1/file: No file uploaded");
        return res.status(400).send();
      }
      logger.info("POST /v1/file: Multer single upload successful");
      next();
    });
  },
  async (req, res) => {
    // Start timing this API call (NEW for overall API duration)
    const apiStartTime = Date.now();
    logger.info("POST /v1/file: Attempting to upload file to S3");

    try {
      if (!process.env.S3_BUCKET) {
        logger.error("POST /v1/file: S3_BUCKET not set in environment");
        return res.status(400).send();
      }

      // Generate IDs and file paths
      const id = uuidv4();
      const fileExtension = path.extname(req.file.originalname);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const s3Key = `${id}/${uniqueFileName}`;

      // Time the S3 upload operation (NEW for S3 metrics)
      const s3StartTime = Date.now();
      await s3
        .upload({
          Bucket: process.env.S3_BUCKET,
          Key: s3Key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
        .promise();
      const s3Duration = Date.now() - s3StartTime;
      metrics.timing('api.file.s3_upload_duration', s3Duration);
      logger.info(`POST /v1/file: S3 upload completed in ${s3Duration} ms`);

      // Time the DB creation operation (NEW for DB metrics)
      const dbStartTime = Date.now();
      const fileRecord = await File.create({
        id: id,
        file_name: req.file.originalname,
        url: `${process.env.S3_BUCKET}/${s3Key}`,
        upload_date: new Date().toISOString().split("T")[0],
      });
      const dbDuration = Date.now() - dbStartTime;
      metrics.timing('api.file.db_create_duration', dbDuration);
      logger.info(`POST /v1/file: DB record creation completed in ${dbDuration} ms`);

      logger.info(`POST /v1/file: Created file record in DB with ID ${id}`);
      
      // Record custom metrics for overall API call duration (NEW for metrics)
      metrics.increment('api.file.upload.count');
      const apiDuration = Date.now() - apiStartTime;
      metrics.timing('api.file.upload.duration', apiDuration);
      logger.info(`POST /v1/file: Total API call duration ${apiDuration} ms`);

      return res.status(201).json({
        file_name: fileRecord.file_name,
        id: id,
        url: fileRecord.url,
        upload_date: fileRecord.upload_date,
      });
    } catch (error) {
      // Record error metric (NEW for metrics)
      metrics.increment('api.file.upload.error');
      logger.error("POST /v1/file: Error uploading file:", error);
      return res.status(503).send();
    }
  }
);

router.head("/", (req, res) => {
  logger.info("HEAD /v1/file: 405 Method Not Allowed");
  return res.status(405).send();
});

router.head("/:id", (req, res) => {
  logger.info(`HEAD /v1/file/${req.params.id}: 405 Method Not Allowed`);
  return res.status(405).send();
});

// GET /v1/file/:id
// - Return 200 + JSON if found, 404 if not found, 500 on error
router.get("/:id", async (req, res) => {
  // Start timing the GET API call (NEW for metrics)
  const apiStartTime = Date.now();
  logger.info(`GET /v1/file/${req.params.id}: Checking query/body/auth headers`);
  if (
    Object.keys(req.query).length > 0 ||
    Object.keys(req.body).length > 0 ||
    req.get("authentication") ||
    req.get("authorization")
  ) {
    logger.warn(`GET /v1/file/${req.params.id}: Rejected - query/body/auth present`);
    return res.status(400).send();
  }

  try {
    // Time the DB query operation (NEW for DB metrics)
    const dbStartTime = Date.now();
    logger.info(`GET /v1/file/${req.params.id}: Searching for file record`);
    const fileRecord = await File.findOne({ where: { id: req.params.id } });
    const dbDuration = Date.now() - dbStartTime;
    metrics.timing('api.file.db_query_duration', dbDuration);
    logger.info(`GET /v1/file/${req.params.id}: DB query duration ${dbDuration} ms`);

    if (!fileRecord) {
      logger.warn(`GET /v1/file/${req.params.id}: File not found`);
      return res.status(404).send();
    }

    logger.info(`GET /v1/file/${req.params.id}: File found, returning 200`);
    const apiDuration = Date.now() - apiStartTime;
    metrics.timing('api.file.get.duration', apiDuration); // Record GET API call duration
    logger.info(`GET /v1/file/${req.params.id}: Total API call duration ${apiDuration} ms`);

    return res.status(200).json({
      file_name: fileRecord.file_name,
      id: fileRecord.id,
      url: fileRecord.url,
      upload_date: fileRecord.upload_date,
    });
  } catch (error) {
    logger.error("GET /v1/file: Error retrieving file:", error);
    return res.status(404).send();
  }
});

// DELETE /v1/file => 400 (no id provided)
router.delete("/", (req, res) => {
  logger.warn("DELETE /v1/file: No ID provided, returning 400");
  return res.status(400).send();
});

// DELETE /v1/file/:id
// - Return 204 on success, 404 if not found, 500 on error
router.delete("/:id", async (req, res) => {
  logger.info(`DELETE /v1/file/${req.params.id}: Attempting to delete file`);
  try {
    const dbStartTime = Date.now();
    const fileRecord = await File.findOne({ where: { id: req.params.id } });
    const dbQueryDuration = Date.now() - dbStartTime;
    metrics.timing('api.file.db_query_duration', dbQueryDuration);
    logger.info(`DELETE /v1/file/${req.params.id}: DB query duration ${dbQueryDuration} ms`);

    if (!fileRecord) {
      logger.warn(`DELETE /v1/file/${req.params.id}: File not found`);
      return res.status(404).send();
    }

    // Time the S3 deletion operation (NEW for S3 metrics)
    const s3StartTime = Date.now();
    const s3Key = fileRecord.url.replace(`${process.env.S3_BUCKET}/`, "");
    logger.info(`DELETE /v1/file/${req.params.id}: Deleting from S3 with Key ${s3Key}`);
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
      })
      .promise();
    const s3DeletionDuration = Date.now() - s3StartTime;
    metrics.timing('api.file.s3_deletion_duration', s3DeletionDuration);
    logger.info(`DELETE /v1/file/${req.params.id}: S3 deletion duration ${s3DeletionDuration} ms`);

    // Time the DB deletion operation (NEW for DB metrics)
    const dbDeletionStart = Date.now();
    logger.info(`DELETE /v1/file/${req.params.id}: Removing record from DB`);
    await fileRecord.destroy();
    const dbDeletionDuration = Date.now() - dbDeletionStart;
    metrics.timing('api.file.db_deletion_duration', dbDeletionDuration);
    logger.info(`DELETE /v1/file/${req.params.id}: DB deletion duration ${dbDeletionDuration} ms`);

    logger.info(`DELETE /v1/file/${req.params.id}: Successfully deleted file record`);
    return res.status(204).send();
  } catch (error) {
    if (error.message && error.message.includes("does not exist")) {
      logger.error("DELETE /v1/file: It looks like the 'File' table might not be created. Ensure DB sync is done.");
    }
    logger.error("DELETE /v1/file: Error deleting file:", error);
    return res.status(404).send();
  }
});

// For all other methods on /v1/file => 405 (empty body)
router.get("/", (req, res) => {
  logger.warn("GET /v1/file: No ID provided, returning 400");
  return res.status(400).send();
});
router.delete("/", (req, res) => {
  logger.warn("DELETE /v1/file: Already defined above, returning 400");
  return res.status(400).send();
});
router.all("/", (req, res) => {
  logger.info("ALL /v1/file: 405 Method Not Allowed");
  return res.status(405).send();
});

// For all other methods on /v1/file/:id => 405 (empty body)
router.all("/:id", (req, res) => {
  logger.info(`ALL /v1/file/${req.params.id}: 405 Method Not Allowed`);
  return res.status(405).send();
});

module.exports = router;
