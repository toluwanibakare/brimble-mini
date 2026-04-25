FROM public.ecr.aws/docker/library/node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]
