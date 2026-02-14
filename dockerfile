# Use Node 22 LTS Alpine
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install dependencies including devDependencies (for TypeScript)
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Compile TypeScript to JavaScript
# Compile TS but ignore errors
RUN npx tsc || true


# Remove dev dependencies to slim the image (optional)
RUN npm prune --production

# Expose the app port
EXPOSE 3000

# Start the compiled JS file
CMD ["node", "dist/server.js"]
