# Frontend Dockerfile for Render Web Service
# Builds the Next.js app and runs it with the PORT env var

FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy the rest of the source
COPY . .

# Build the Next.js app
RUN npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app

# Copy only the necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/app ./app

ENV PORT 3000
EXPOSE 3000

CMD ["npm", "start"]
