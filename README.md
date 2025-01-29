# webapp

The /healthz endpoint serves as the health check mechanism, which will perform the following tasks:

- Insert a record in the health check table.
- Return HTTP 200 OK if the record was inserted successfully.
- Return HTTP 503 Service Unavailable if the insert command fails.
- Ensure that no payload is accepted in the request, returning HTTP 400 Bad Request if the request includes any payload (even empty - payloads like {} or "").
- Set appropriate cache headers to prevent caching of the response.
- Only accept the HTTP GET method. Any other method (e.g., PUT, POST) will result in an HTTP 405 Method Not Allowed.
