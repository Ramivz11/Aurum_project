FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Ensure vite bin is executable (evita `sh: 1: vite: Permission denied` en algunos entornos)
RUN if [ -f ./node_modules/.bin/vite ]; then chmod +x ./node_modules/.bin/vite; fi && npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
