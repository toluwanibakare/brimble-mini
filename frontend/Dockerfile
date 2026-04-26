FROM public.ecr.aws/docker/library/node:20
WORKDIR /app
COPY package*.json ./
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
