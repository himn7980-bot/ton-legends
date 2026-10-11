FROM node:20-alpine
WORKDIR /app
COPY src ./src
COPY server ./server
ENV NODE_ENV=production PORT=3000 DATA_FILE=/data/db.json
EXPOSE 3000
CMD ["node", "server/server.js"]
