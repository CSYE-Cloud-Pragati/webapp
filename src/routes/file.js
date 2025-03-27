// file.js
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
    if (
      Object.keys(req.query).length > 0 ||
      req.get("authentication") ||
      req.get("authorization")
    ) {
      return res.status(400).send();
    }
    next();
  },
  (req, res, next) => {
    const singleUpload = upload.single("profilePic");
    singleUpload(req, res, function (err) {
      if (err) {
        return res.status(400).send();
      }
      if (!req.file) {
        return res.status(400).send();
      }
      next();
    });
  },
  async (req, res) => {
    const apiStartTime = Date.now();
    try {
      if (!process.env.S3_BUCKET) {
        return res.status(400).send();
      }

      const id = uuidv4();
      const fileExtension = path.extname(req.file.originalname);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const s3Key = `${id}/${uniqueFileName}`;

      const s3StartTime = Date.now();
      await s3
        .upload({
          Bucket: process.env.S3_BUCKET,
          Key: s3Key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
        .promise();
      metrics.timing('api.file.s3_upload_duration', Date.now() - s3StartTime);

      const dbStartTime = Date.now();
      const fileRecord = await File.create({
        id: id,
        file_name: req.file.originalname,
        url: `${process.env.S3_BUCKET}/${s3Key}`,
        upload_date: new Date().toISOString().split("T")[0],
      });
      metrics.timing('api.file.db_create_duration', Date.now() - dbStartTime);

      metrics.increment('api.file.upload.count');
      metrics.timing('api.file.upload.duration', Date.now() - apiStartTime);

      return res.status(201).json({
        file_name: fileRecord.file_name,
        id: id,
        url: fileRecord.url,
        upload_date: fileRecord.upload_date,
      });
    } catch (error) {
      metrics.increment('api.file.upload.error');
      return res.status(503).send();
    }
  }
);

router.head("/", (req, res) => {
  return res.status(405).send();  // Reverted from 404
});

router.head("/:id", (req, res) => {
  return res.status(405).send();  // Reverted from 404
});

router.get("/:id", async (req, res) => {
  const apiStartTime = Date.now();
  if (
    Object.keys(req.query).length > 0 ||
    Object.keys(req.body).length > 0 ||
    req.get("authentication") ||
    req.get("authorization")
  ) {
    return res.status(400).send();
  }

  try {
    const dbStartTime = Date.now();
    const fileRecord = await File.findOne({ where: { id: req.params.id } });
    metrics.timing('api.file.db_query_duration', Date.now() - dbStartTime);

    if (!fileRecord) {
      return res.status(404).send();
    }

    metrics.timing('api.file.get.duration', Date.now() - apiStartTime);
    return res.status(200).json({
      file_name: fileRecord.file_name,
      id: fileRecord.id,
      url: fileRecord.url,
      upload_date: fileRecord.upload_date,
    });
  } catch (error) {
    return res.status(404).send();
  }
});

router.delete("/", (req, res) => {
  return res.status(400).send();  // Reverted from 404
});

router.delete("/:id", async (req, res) => {
  try {
    const fileRecord = await File.findOne({ where: { id: req.params.id } });
    if (!fileRecord) {
      return res.status(404).send();
    }

    const s3Key = fileRecord.url.replace(`${process.env.S3_BUCKET}/`, "");
    await s3
      .deleteObject({
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
      })
      .promise();

    await fileRecord.destroy();
    return res.status(204).send();
  } catch (error) {
    return res.status(404).send();
  }
});

router.get("/", (req, res) => {
  return res.status(400).send();  // Reverted from 404
});

router.all("/", (req, res) => {
  return res.status(405).send();  // Reverted from 404
});

router.all("/:id", (req, res) => {
  return res.status(405).send();  // Reverted from 404
});

module.exports = router;
