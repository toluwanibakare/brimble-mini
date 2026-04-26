FROM public.ecr.aws/docker/library/node:20-alpine
WORKDIR /app

# Install curl and git
RUN apk add --no-cache curl git

# Copy docker CLI binary directly from official image
COPY --from=public.ecr.aws/docker/library/docker:latest /usr/local/bin/docker /usr/local/bin/docker

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
