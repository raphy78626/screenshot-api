# Tag MUST match the pinned playwright version in package.json.
# When bumping playwright, update both in the same commit.
FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

EXPOSE 8080

# Never run Chromium --no-sandbox as root
USER pwuser

CMD ["npx", "tsx", "src/server.ts"]
