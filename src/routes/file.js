const express = require("express");
const router = express.Router();
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const s3 = require("../config/s3");
const File = require("../models/file");

const logger = require("../config/logger");
const metrics = require("../config/metrics");

// Configure multer
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
router.post(
  "/",
  (req, res, next) => {
    logger.info("[POST /v1/file] Validating request for unexpected params");
    if (
      Object.keys(req.query).length > 0 ||
      req.get("authentication") ||
      req.get("authorization")
    ) {
      logger.warn("[POST /v1/file] Rejected - unexpected query or auth headers");
      metrics.increment("api.file.upload.rejected_query_or_auth");
      return res.status(400).send();
    }
    next();
  },
  (req, res, next) => {
    logger.info("[POST /v1/file] Initiating file upload validation via multer");
    const singleUpload = upload.single("profilePic");

    singleUpload(req, res, function (err) {
      if (err) {
        metrics.increment("api.file.upload.multer_error");
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          logger.warn("[POST /v1/file] Unexpected file field");
          return res.status(400).send();
        }
        if (err.message === "Only image files are allowed") {
          logger.warn("[POST /v1/file] Non-image file rejected");
          return res.status(400).send();
        }
        if (err.code === "LIMIT_FILE_SIZE") {
          logger.warn("[POST /v1/file] File too large (limit 5MB)");
          return res.status(400).send();
        }
        logger.error("[POST /v1/file] Multer error:", err);
        return res.status(400).send();
      }

      if (!req.file) {
        logger.warn("⚠️ [POST /v1/file] No file provided in request");
        metrics.increment("api.file.upload.no_file");
        return res.status(400).send();
      }

      logger.info("[POST /v1/file] File validation successful, proceeding to upload");
      next();
    });
  },
  async (req, res) => {
    const apiStartTime = Date.now();
    logger.info("[POST /v1/file] Uploading file to S3");

    try {
      if (!process.env.S3_BUCKET) {
        logger.error("[POST /v1/file] Missing S3_BUCKET in environment");
        return res.status(400).send();
      }

      const id = uuidv4();
      const fileExtension = path.extname(req.file.originalname);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const s3Key = `${id}/${uniqueFileName}`;

      const s3StartTime = Date.now();
      await s3.upload({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }).promise();
      const s3Duration = Date.now() - s3StartTime;
      metrics.timing("api.file.s3_upload_duration", s3Duration);
      logger.info(`[POST /v1/file] File uploaded to S3 in ${s3Duration}ms`);

      const dbStartTime = Date.now();
      const fileRecord = await File.create({
        id: id,
        file_name: req.file.originalname,
        url: `${process.env.S3_BUCKET}/${s3Key}`,
        upload_date: new Date().toISOString().split("T")[0],
      });
      const dbDuration = Date.now() - dbStartTime;
      metrics.timing("api.file.db_create_duration", dbDuration);
      logger.info(`[POST /v1/file] DB record created in ${dbDuration}ms`);

      metrics.increment("api.file.upload.count");
      const apiDuration = Date.now() - apiStartTime;
      metrics.timing("api.file.upload.duration", apiDuration);
      logger.info(`[POST /v1/file] API completed in ${apiDuration}ms`);

      return res.status(201).json({
        file_name: fileRecord.file_name,
        id: id,
        url: fileRecord.url,
        upload_date: fileRecord.upload_date,
      });
    } catch (error) {
      metrics.increment("api.file.upload.error");
      logger.error("[POST /v1/file] Upload failed", error);
      return res.status(503).send();
    }
  }
);

// HEAD /v1/file
router.head("/", (req, res) => {
  logger.info("[HEAD /v1/file] Method not allowed");
  return res.status(405).send();
});
router.head("/:id", (req, res) => {
  logger.info(`[HEAD /v1/file/${req.params.id}] Method not allowed`);
  return res.status(405).send();
});

// GET /v1/file/:id
router.get("/:id", async (req, res) => {
  const apiStartTime = Date.now();
  logger.info(`[GET /v1/file/${req.params.id}] Searching for file`);

  if (
    Object.keys(req.query).length > 0 ||
    Object.keys(req.body).length > 0 ||
    req.get("authentication") ||
    req.get("authorization")
  ) {
    logger.warn("[GET /v1/file] Invalid headers or query detected");
    metrics.increment("api.file.get.invalid_request");
    return res.status(400).send();
  }

  try {
    const dbStartTime = Date.now();
    const fileRecord = await File.findOne({ where: { id: req.params.id } });
    const dbDuration = Date.now() - dbStartTime;
    metrics.timing("api.file.db_query_duration", dbDuration);

    if (!fileRecord) {
      logger.warn("⚠️ [GET /v1/file] File not found");
      metrics.increment("api.file.get.not_found");
      return res.status(404).send();
    }

    const apiDuration = Date.now() - apiStartTime;
    metrics.timing("api.file.get.duration", apiDuration);
    logger.info(`[GET /v1/file] File found and returned in ${apiDuration}ms`);

    return res.status(200).json({
      file_name: fileRecord.file_name,
      id: fileRecord.id,
      url: fileRecord.url,
      upload_date: fileRecord.upload_date,
    });
  } catch (error) {
    metrics.increment("api.file.get.error");
    logger.error("[GET /v1/file] Error retrieving file", error);
    return res.status(404).send();
  }
});

// DELETE /v1/file => 400
router.delete("/", (req, res) => {
  logger.warn("[DELETE /v1/file] No ID provided");
  metrics.increment("api.file.delete.missing_id");
  return res.status(400).send();
});

// DELETE /v1/file/:id
router.delete("/:id", async (req, res) => {
  logger.info(`[DELETE /v1/file/${req.params.id}] Attempting to delete`);

  try {
    const dbStartTime = Date.now();
    const fileRecord = await File.findOne({ where: { id: req.params.id } });
    const dbQueryDuration = Date.now() - dbStartTime;
    metrics.timing("api.file.db_query_duration", dbQueryDuration);

    if (!fileRecord) {
      logger.warn("⚠️ [DELETE /v1/file] File not found");
      metrics.increment("api.file.delete.not_found");
      return res.status(404).send();
    }

    const s3StartTime = Date.now();
    const s3Key = fileRecord.url.replace(`${process.env.S3_BUCKET}/`, "");
    await s3.deleteObject({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
    }).promise();
    const s3Duration = Date.now() - s3StartTime;
    metrics.timing("api.file.s3_deletion_duration", s3Duration);
    logger.info(`[DELETE /v1/file] S3 file deleted in ${s3Duration}ms`);

    const dbDeleteStart = Date.now();
    await fileRecord.destroy();
    const dbDeleteDuration = Date.now() - dbDeleteStart;
    metrics.timing("api.file.db_deletion_duration", dbDeleteDuration);
    logger.info(`[DELETE /v1/file] DB record deleted in ${dbDeleteDuration}ms`);

    metrics.increment("api.file.delete.success");
    return res.status(204).send();
  } catch (error) {
    metrics.increment("api.file.delete.error");
    logger.error("[DELETE /v1/file] Deletion failed", error);
    return res.status(404).send();
  }
});

// Other method handlers
router.get("/", (req, res) => {
  logger.warn("[GET /v1/file] No ID provided");
  return res.status(400).send();
});
router.delete("/", (req, res) => {
  logger.warn("[DELETE /v1/file] Already handled above");
  return res.status(400).send();
});
router.all("/", (req, res) => {
  logger.info("[ALL /v1/file] Method not allowed");
  return res.status(405).send();
});
router.all("/:id", (req, res) => {
  logger.info(`[ALL /v1/file/${req.params.id}] Method not allowed`);
  return res.status(405).send();
});

module.exports = router;
