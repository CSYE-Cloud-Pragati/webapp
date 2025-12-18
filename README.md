# WebApp (Backend API) — CSYE 6225

This repository contains a **Node.js web application** built for **CSYE 6225 (Network Structures & Cloud Computing)**.  
It is designed to run on AWS EC2 instances behind an Application Load Balancer (ALB) and connect to a managed PostgreSQL database on Amazon RDS.

This repo is **paired** with the infrastructure repo (**tf-aws-infra**) which provisions the cloud resources required to deploy and run this service.

---

## What this repo contains

### API 
This project is an **API-only service**. It is intended to be used via:
- Postman / cURL
- automated integration tests
- traffic routed through ALB → EC2 instances

### Health Check endpoint
A `/healthz` endpoint is implemented to validate:
- application availability
- database connectivity (inserts a record into a health check table)

**Strict behavior** (as required in the assignment):
- `GET` only → other methods return `405`
- no payload allowed → payload returns `400` (even `{}` or `""`)
- no auth headers allowed → returns `403`
- cache is disabled via response headers
- DB insert success → `200`, DB failure → `503`

### File / object handling + AWS integration
The codebase includes configuration and route modules typically used for:
- database connection handling
- logging
- custom metrics
- S3 integration

(See `src/config/` and `src/routes/`.)

### Automated testing
Tests are included (example: health check tests) under:
- `src/tests/`

### CI + AMI build pipeline (GitHub Actions + Packer)
This repo includes GitHub Actions workflows and a Packer template to produce a deployable AMI:
- packer validation / AMI creation workflow(s)
- provisioning scripts + systemd service file used to run the app on EC2

This AMI is then consumed by the **Launch Template / Auto Scaling Group** in the `tf-aws-infra` repo.

---

## Repository structure (high-level)

- `index.js` — app entrypoint
- `package.json` — dependencies + scripts
- `src/routes/` — API routes
- `src/models/` — DB models (health check, file, etc.)
- `src/config/` — DB, logger, metrics, S3 config
- `src/tests/` — unit/integration tests
- `src/ubuntu.pkr.hcl` — Packer template to build AMI
- `src/script.sh` — provisioning steps for AMI build
- `src/application.service` — systemd service definition
- `.github/workflows/` — CI + packer/AMI pipelines

---

## Running locally

### Prerequisites
- Node.js (LTS)
- npm
- a PostgreSQL database (local or remote)

### Install + run
```bash
npm install
npm start
