FROM node:20-alpine

WORKDIR /app

COPY app/package*.json ./

RUN npm install --omit=dev

COPY app/ .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health-failure || exit 1

CMD ["npm", "start"]