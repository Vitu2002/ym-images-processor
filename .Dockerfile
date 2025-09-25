# ---- Build stage ----
# Bun image
FROM oven/bun:alpine AS builder

# Install dependencies to sharp
RUN apk add --no-cache python3 make g++ libc6-compat vips-dev

# Create app directory
WORKDIR /app

# Install app dependencies (use frozen lockfile for reproducibility)
COPY package.json package-lock.json* bun.lockb* ./
RUN bun install --frozen-lockfiles

# Copy app source
COPY . .

# Build Next.js
RUN bun run build

# ---- Run stage ----
# Bun image
FROM oven/bun:alpine AS runner

# Install dependencies to sharp
RUN apk add --no-cache libc6-compat vips-dev

# Create app directory
WORKDIR /yomu/api

# Copy node_modules already built
COPY --from=builder /app/node_modules ./node_modules

# Copy built app
COPY --from=builder /app/dist ./dist
COPY package.json ./

# Set NODE_ENV to production
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Run app
CMD ["bun", "run", "start:prod"]
