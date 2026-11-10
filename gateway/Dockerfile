FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY gateway/package.json gateway/package.json
RUN npm ci --workspace=gateway --omit=dev --ignore-scripts
COPY gateway/src gateway/src
USER node
EXPOSE 3000
CMD ["node","gateway/src/server.js"]
