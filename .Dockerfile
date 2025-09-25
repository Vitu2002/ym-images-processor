# Bun image
FROM oven/bun:alpine

# Install dependencies to sharp
RUN apk add --no-cache python3 make g++ libc6-compat vips-dev

# Create app directory
WORKDIR /yomu

# Install app dependencies (use frozen lockfile for reproducibility)
COPY package.json package-lock.json* bun.lockb* ./
RUN bun install --frozen-lockfiles

# Copy app source
COPY . .

# Build NestJs
RUN bun run build

# Expose port
EXPOSE 3000

# Set NODE_ENV to production
ENV NODE_ENV=production

# Run app
CMD ["bun", "start:prod"]
