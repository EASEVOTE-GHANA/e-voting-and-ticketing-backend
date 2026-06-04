FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application
# This runs tsc and copies templates/public to dist/
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy dependencies and package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built files
COPY --from=builder /app/dist ./dist

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["npm", "start"]
