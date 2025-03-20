const request = require("supertest");
const path = require("path");
const app = require("../../index");
const sequelize = require("../config/database");
const File = require("../models/file");

describe("File Routes Tests", () => {
  beforeAll(async () => {
    await sequelize.sync({ force: false });
  });

  afterAll(async () => {
    await sequelize.close();
  });


  test("POST /v1/file with query params returns 400", async () => {
    const response = await request(app)
      .post("/v1/file?extra=1")
      .attach("profilePic", path.join(__dirname, "img", "testImage.png"));
    
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
  });


  test("GET /v1/file/:id for non-existing id returns 404", async () => {
    const nonExistingId = "123e4567-e89b-12d3-a456-426614174000"; 
    const response = await request(app).get(`/v1/file/${nonExistingId}`);
    
    expect(response.status).toBe(404);
    expect(response.text).toBeFalsy();
  });


  test("DELETE /v1/file with no id returns 400", async () => {
    const response = await request(app).delete("/v1/file");
    
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
  });


  test("HEAD /v1/file returns 405", async () => {
    const response = await request(app).head("/v1/file");
    
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
  });
});
