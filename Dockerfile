FROM node:23-bookworm-slim

WORKDIR /app

RUN apt-get update -y && \
    apt-get install -y python3 build-essential tzdata && \
    rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Jakarta

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "start"]