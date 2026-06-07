# --- Build / Compilation Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
copy package*.json ./

# Install packages
RUN npm ci

# Copy codebase
COPY . .

# Build Vite client production assets and compile CJS Server bundle via Esbuild
RUN npm run build

# --- Production Runtime Stage ---
FROM node:20-alpine

WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production
ENV PORT=3000

# Copy built artifacts from builders
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Install production dependencies only (saves space and memory)
RUN npm ci --only=production

# Expose server ingress port
EXPOSE 3000

# Start server
CMD ["npm", "run", "start"]
