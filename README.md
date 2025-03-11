# Health Check API

The **Health Check API** monitors the application's health by checking database connectivity and ensuring the instance is operational. It prevents routing traffic to unhealthy instances and supports automatic recovery mechanisms.

## **/healthz Endpoint**

### **Method: `GET`**

This endpoint performs the following actions:

- **Inserts a record** into the health check table.
- **Returns HTTP 200 OK** if the record is successfully inserted.
- **Returns HTTP 503 Service Unavailable** if the database insert fails.
- **Ensures that no payload is accepted** in the request, returning **HTTP 400 Bad Request** if a payload (even `{}` or `""`) is present.
- **Restricts authentication usage**, returning **HTTP 403 Forbidden** for any request with authentication headers.
- **Accepts only the `GET` method**, returning **HTTP 405 Method Not Allowed** for all others.
- **Prevents response caching** by setting appropriate headers.
   
---

## **Example Requests and Responses**

### 1. **Success (HTTP 200 OK)**

If the health check record is successfully inserted into the database, the server will respond with:

#### Request:

```bash
curl -vvvv http://localhost:8080/healthz 
```

### 2. **Failure (HTTP 503 Service Unavailable)**

If there is an issue inserting the record (e.g., database connection failure), the server will respond with:

#### Request:

```bash
curl -vvvv http://localhost:8080/healthz
```

### 2. **Method Not Allowed (405 Method Not Allowed)**

If any method other than GET is used (e.g., PUT, POST), the request is rejected:

#### Request:

```bash
curl -vvvv -XPUT http://localhost:8080/healthz
```


