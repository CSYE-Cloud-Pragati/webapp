const request = require("supertest");
const { Sequelize, DataTypes } = require("sequelize");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), override: true });

// Create a fresh isolated connection for this test suite
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "postgres",
    logging: false,
  }
);

// Re-define HealthCheck model against this connection
const HealthCheck = sequelize.define("HealthCheck", {
  check_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  datetime: {
    type: DataTypes.DATE,
    defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
  },
}, { timestamps: false });

const app = require("../../index");

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe("Health Check Route Tests Running....", () => {
  it("should return 200 OK with correct headers and empty body", async () => {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.text).toBe("");
    expect(response.headers).toHaveProperty("cache-control", "no-cache, no-store, must-revalidate");
    expect(response.headers).toHaveProperty("pragma", "no-cache");
    expect(response.headers).toHaveProperty("x-content-type-options", "nosniff");
  });

  it("should return 400 Bad Request for GET /healthz with query parameters", async () => {
    const response = await request(app).get("/healthz?Key=1");
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
  });

  it("should return 400 Bad Request for GET /healthz with an invalid Bearer Token", async () => {
    const response = await request(app).get("/healthz").set("Authorization", "Bearer adsf");
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
  });

  it("should return 400 Bad Request for GET /healthz with an empty JSON payload", async () => {
    const response = await request(app).get("/healthz").send({});
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
  });

  it("should return 400 Bad Request for GET /healthz with a JSON payload", async () => {
    const response = await request(app).get("/healthz").send({ checkId: 1 });
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
  });

  it("should return 400 Bad Request for GET /healthz with a bad JSON payload", async () => {
    const response = await request(app).get("/healthz").send("sdkhsakfh");
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
  });

  it("should return 404 Not Found for an incorrect endpoint", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(404);
    expect(response.text).toBeFalsy();
  });

  it("should return 503 Service Unavailable if database operation fails", async () => {
    const HealthCheckModel = require("../models/healthCheck");
    jest.spyOn(HealthCheckModel, "create").mockRejectedValueOnce(new Error("DB failure"));
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(503);
    expect(response.text).toBeFalsy();
    HealthCheckModel.create.mockRestore();
  });

  it("should return 405 Method Not Allowed for HEAD request to /healthz", async () => {
    const response = await request(app).head("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
  });

  it("should return 405 Method Not Allowed for POST request to /healthz", async () => {
    const response = await request(app).post("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
  });

  it("should return 405 Method Not Allowed for PUT request to /healthz", async () => {
    const response = await request(app).put("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
  });

  it("should return 405 Method Not Allowed for PATCH request to /healthz", async () => {
    const response = await request(app).patch("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
  });

  it("should return 405 Method Not Allowed for DELETE request to /healthz", async () => {
    const response = await request(app).delete("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
  });

  it("should return 405 Method Not Allowed for OPTIONS request to /healthz", async () => {
    const response = await request(app).options("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
  });
});
