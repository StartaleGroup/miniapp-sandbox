FROM node:20-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml* .npmrc* ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json* postcss.config.* ./
COPY src ./src
COPY public ./public
RUN npx vite build
RUN ls -la /app/dist/index.html

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3100
CMD ["nginx", "-g", "daemon off;"]
