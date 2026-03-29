const request = require("supertest");
const { Sequelize } = require("sequelize");
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

// Re-define models against this connection
const { DataTypes } = require("sequelize");
const File = sequelize.define("File", {
  id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
  file_name: { type: DataTypes.STRING, allowNull: false },
  url: { type: DataTypes.STRING, allowNull: false },
  upload_date: { type: DataTypes.DATEONLY, allowNull: false },
}, { timestamps: false, tableName: "files" });

const app = require("../../index");

describe("File Routes Tests", () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test("POST /v1/file with query params returns 400", async () => {
    const imgPath = path.join(__dirname, "img", "testImage.png");
    const response = await request(app)
      .post("/v2/file?extra=1")
      .attach("profilePic", imgPath);
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
  });

  test("GET /v1/file/:id for non-existing id returns 404", async () => {
    const nonExistingId = "123e4567-e89b-12d3-a456-426614174000";
    const response = await request(app).get(`/v2/file/${nonExistingId}`);
    expect(response.status).toBe(404);
    expect(response.text).toBeFalsy();
  });

  test("DELETE /v1/file with no id returns 400", async () => {
    const response = await request(app).delete("/v2/file");
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
  });

  test("HEAD /v1/file returns 405", async () => {
    const response = await request(app).head("/v2/file");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
  });
});
