# Node.js LTS lightweight Alpine image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Ensure upload and data directories exist with proper write permissions
RUN mkdir -p public/uploads data

# Expose web port (Render, Railway, Cloud Run inject $PORT)
ENV PORT=3000
EXPOSE 3000

# Start server
CMD ["node", "server/server.js"]
