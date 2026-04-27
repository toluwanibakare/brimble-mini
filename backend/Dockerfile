FROM node:20-bookworm-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    git \
    bash \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Fix HTTP/2 stream errors when cloning large repos
RUN git config --global http.version HTTP/1.1 && \
    git config --global http.postBuffer 524288000

# Copy docker CLI binary directly from official image
COPY --from=docker:latest /usr/local/bin/docker /usr/local/bin/docker

# Install nixpacks from GitHub releases (latest v1.41.0)
RUN curl -fsSL https://github.com/railwayapp/nixpacks/releases/download/v1.41.0/nixpacks-v1.41.0-x86_64-unknown-linux-gnu.tar.gz -o /tmp/nixpacks.tar.gz && \
    tar -xzf /tmp/nixpacks.tar.gz -C /usr/local/bin && \
    chmod +x /usr/local/bin/nixpacks && \
    rm /tmp/nixpacks.tar.gz && \
    nixpacks --version

# Railpack install - use nixpacks instead which is already installed above

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
