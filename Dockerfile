# ── Stage: production image ──────────────────────────────────────────
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests first (layer cache optimisation)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source
COPY index.js ./
COPY src/ ./src/

# Create the log directory the app writes to (non-production path)
RUN mkdir -p /app/logs

# The app reads PORT from env; default 8080 matches index.js fallback
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]
