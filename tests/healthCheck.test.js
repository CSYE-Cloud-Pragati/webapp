const request = require("supertest");
const app = require("../index");
const HealthCheck = require("../models/healthCheck"); 

describe("Health Check Route Tests Running....", () => {
    // Get request with no payload or params
    it("should return 200 OK with correct headers and empty body", async () => {
        console.log(HealthCheck);
        const response = await request(app).get("/healthz");
        expect(response.status).toBe(200);
        expect(response.text).toBe(""); 
        expect(response.headers).toHaveProperty("cache-control", "no-cache, no-store, must-revalidate");
        expect(response.headers).toHaveProperty("pragma", "no-cache");
        expect(response.headers).toHaveProperty("x-content-type-options", "nosniff");
    });

    // Get request with query parameters (should return 400)
it("should return 400 Bad Request for GET /healthz with query parameters", async () => {
    const response = await request(app)
        .get("/healthz?Key=1"); 
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
});

// Get request with invalid authorization token (should return 400)
it("should return 400 Bad Request for GET /healthz with an invalid Bearer Token", async () => {
    const response = await request(app)
        .get("/healthz")
        .set("Authorization", "Bearer adsf"); 
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
});

// Get request with empty payload `{}` (should return 400)
it("should return 400 Bad Request for GET /healthz with an empty JSON payload", async () => {
    const response = await request(app)
        .get("/healthz")
        .send({}); 
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
});

// Get request with JSON payload `{ checkId: 1 }` (should return 400)
it("should return 400 Bad Request for GET /healthz with a JSON payload", async () => {
    const response = await request(app)
        .get("/healthz")
        .send({ checkId: 1 }); 
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
});

// Get request with bad JSON payload `sdkhsakfh` (should return 400)
it("should return 400 Bad Request for GET /healthz with a bad JSON payload", async () => {
    const response = await request(app)
        .get("/healthz")
        .send("sdkhsakfh"); 
    expect(response.status).toBe(400);
    expect(response.text).toBeFalsy();
});

// Get with wrong endpoint (should return 404)
it("should return 404 Not Found for an incorrect endpoint", async () => {
    const response = await request(app)
        .get("/health"); 
    expect(response.status).toBe(404);
    expect(response.text).toBeFalsy();
});

// GET request when an internal server error occurs (should return 503)
it("should return 503 Service Unavailable if database operation fails", async () => {
    jest.spyOn(HealthCheck, "create").mockRejectedValueOnce(new Error("DB failure"));
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(503);
    expect(response.text).toBeFalsy();
    HealthCheck.create.mockRestore(); 
});

// HEAD request (should return 405)
it("should return 405 Method Not Allowed for HEAD request to /healthz", async () => {
    const response = await request(app)
        .head("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
});

// POST request (should return 405)
it("should return 405 Method Not Allowed for POST request to /healthz", async () => {
    const response = await request(app)
        .post("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
});

// PUT request (should return 405)
it("should return 405 Method Not Allowed for PUT request to /healthz", async () => {
    const response = await request(app)
        .put("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
});

// PATCH request (should return 405)
it("should return 405 Method Not Allowed for PATCH request to /healthz", async () => {
    const response = await request(app)
        .patch("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
});

// DELETE request (should return 405)
it("should return 405 Method Not Allowed for DELETE request to /healthz", async () => {
    const response = await request(app)
        .delete("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
});

// OPTIONS request (should return 405)
it("should return 405 Method Not Allowed for OPTIONS request to /healthz", async () => {
    const response = await request(app)
        .options("/healthz");
    expect(response.status).toBe(405);
    expect(response.text).toBeFalsy();
});


});
