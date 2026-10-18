# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Sem VITE_API_URL o front chama /api no mesmo domínio, e o nginx repassa para o backend
RUN npm run build

# ---- runtime ----
FROM nginx:1.29-alpine
# Endereço do backend visto pelo nginx (no Railway, a rede privada do serviço "api")
ENV API_UPSTREAM=http://api.railway.internal:3333
ENV PORT=8080
# Lê o DNS do /etc/resolv.conf para o nginx reresolver o backend a cada redeploy dele
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
# O auto do nginx abre um worker por CPU do host (dezenas no Railway), gastando RAM à toa
RUN sed -i 's/^worker_processes.*/worker_processes 2;/' /etc/nginx/nginx.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
