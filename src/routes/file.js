const express = require("express");
const router = express.Router();
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const s3 = require("../config/s3");
const File = require("../models/file");
const logger = require("../config/logger");
const metrics = require("../config/metrics");

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

router.post(
  "/",
  (req, res, next) => {
    logger.info("[POST /v1/file] Validating request: no query or auth headers allowed");
    if (
      Object.keys(req.query).length > 0 ||
      req.get("authentication") ||
      req.get("authorization")
    ) {
      logger.warn("[POST /v1/file] Request rejected due to query/auth headers");
      metrics.increment("api.file.upload.rejected");
      return res.status(400).send();
    }
    next();
  },
  (req, res, next) => {
    const singleUpload = upload.single("profilePic");
    singleUpload(req, res, function (err) {
      if (err) {
        logger.warn(`[POST /v1/file] Upload failed: ${err.message}`);
        metrics.increment("api.file.upload.error");
        return res.status(400).send();
      }
      if (!req.file) {
        logger.warn("[POST /v1/file] Upload failed: No file provided");
        metrics.increment("api.file.upload.missing_file");
        return res.status(400).send();
      }
      logger.info("[POST /v1/file] Upload passed multer validation");
      next();
    });
  },
  async (req, res) => {
    const apiStart = Date.now();
    logger.info("[POST /v1/file] Initiating file upload to S3 and DB storage");

    try {
      const id = uuidv4();
      const fileExtension = path.extname(req.file.originalname);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const s3Key = `${id}/${uniqueFileName}`;

      const s3Start = Date.now();
      await s3.upload({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }).promise();
      const s3Duration = Date.now() - s3Start;
      logger.info(`[POST /v1/file] Uploaded file to S3 in ${s3Duration} ms`);
      metrics.timing("api.file.s3_upload_duration", s3Duration);

      const dbStart = Date.now();
      const fileRecord = await File.create({
        id,
        file_name: req.file.originalname,
        url: `${process.env.S3_BUCKET}/${s3Key}`,
        upload_date: new Date().toISOString().split("T")[0],
      });
      const dbDuration = Date.now() - dbStart;
      logger.info(`[POST /v1/file] File record stored in DB in ${dbDuration} ms`);
      metrics.timing("api.file.db_create_duration", dbDuration);

      const apiDuration = Date.now() - apiStart;
      metrics.increment("api.file.upload.count");
      metrics.timing("api.file.upload.duration", apiDuration);
      logger.info(`[POST /v1/file] Upload API completed in ${apiDuration} ms`);

      return res.status(201).json({
        file_name: fileRecord.file_name,
        id: fileRecord.id,
        url: fileRecord.url,
        upload_date: fileRecord.upload_date,
      });
    } catch (err) {
      logger.error("[POST /v1/file] Unexpected error during upload", err);
      metrics.increment("api.file.upload.exception");
      return res.status(503).send();
    }
  }
);

router.get("/:id", async (req, res) => {
  const apiStart = Date.now();
  logger.info(`[GET /v1/file/${req.params.id}] Fetching file metadata`);

  if (
    Object.keys(req.query).length > 0 ||
    Object.keys(req.body).length > 0 ||
    req.get("authentication") ||
    req.get("authorization")
  ) {
    logger.warn(`[GET /v1/file/${req.params.id}] Invalid request with query/body/auth headers`);
    metrics.increment("api.file.get.rejected");
    return res.status(400).send();
  }

  try {
    const dbStart = Date.now();
    const file = await File.findOne({ where: { id: req.params.id } });
    const dbDuration = Date.now() - dbStart;
    metrics.timing("api.file.db_query_duration", dbDuration);

    if (!file) {
      logger.warn(`[GET /v1/file/${req.params.id}] File not found in DB`);
      metrics.increment("api.file.get.not_found");
      return res.status(404).send();
    }

    const apiDuration = Date.now() - apiStart;
    metrics.increment("api.file.get.count");
    metrics.timing("api.file.get.duration", apiDuration);
    logger.info(`[GET /v1/file/${req.params.id}] Metadata served in ${apiDuration} ms`);

    return res.status(200).json(file);
  } catch (err) {
    logger.error(`[GET /v1/file/${req.params.id}] Error while fetching file:`, err);
    metrics.increment("api.file.get.exception");
    return res.status(500).send();
  }
});

router.delete("/:id", async (req, res) => {
  logger.info(`[DELETE /v1/file/${req.params.id}] Deleting file from S3 and DB`);

  try {
    const dbStart = Date.now();
    const file = await File.findOne({ where: { id: req.params.id } });
    const dbQueryDuration = Date.now() - dbStart;
    metrics.timing("api.file.db_query_duration", dbQueryDuration);

    if (!file) {
      logger.warn(`[DELETE /v1/file/${req.params.id}] File not found in DB`);
      metrics.increment("api.file.delete.not_found");
      return res.status(404).send();
    }

    const s3Start = Date.now();
    const s3Key = file.url.replace(`${process.env.S3_BUCKET}/`, "");
    await s3.deleteObject({ Bucket: process.env.S3_BUCKET, Key: s3Key }).promise();
    const s3Duration = Date.now() - s3Start;
    metrics.timing("api.file.s3_delete_duration", s3Duration);
    logger.info(`[DELETE /v1/file/${req.params.id}] File removed from S3 in ${s3Duration} ms`);

    const dbDeleteStart = Date.now();
    await file.destroy();
    const dbDeleteDuration = Date.now() - dbDeleteStart;
    metrics.timing("api.file.db_delete_duration", dbDeleteDuration);
    logger.info(`[DELETE /v1/file/${req.params.id}] Record deleted from DB in ${dbDeleteDuration} ms`);

    metrics.increment("api.file.delete.count");
    return res.status(204).send();
  } catch (err) {
    logger.error(`[DELETE /v1/file/${req.params.id}] Error during deletion:`, err);
    metrics.increment("api.file.delete.exception");
    return res.status(500).send();
  }
});

module.exports = router;
