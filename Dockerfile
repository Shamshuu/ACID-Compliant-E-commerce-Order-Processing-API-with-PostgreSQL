# Build Stage
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json tsconfig.json knexfile.ts ./
RUN npm install

COPY src ./src
COPY migrations ./migrations

RUN npm run build

# Production Stage
FROM node:20-alpine AS runner
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/dist/knexfile.js ./knexfile.js
COPY --from=builder /usr/src/app/dist/migrations ./migrations

EXPOSE 8080

# Run migrations and start the application
CMD npm run migrate && npm start
