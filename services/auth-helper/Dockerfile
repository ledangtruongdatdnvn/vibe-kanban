FROM node:20-alpine
WORKDIR /app
COPY server.js .
ENV NODE_ENV=production
# Run as node (UID 1000) so saved credential files are readable by the HOST container
# which also runs as node (UID 1000).
USER node
EXPOSE 3005
CMD ["node", "server.js"]
