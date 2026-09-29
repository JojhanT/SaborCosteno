# syntax=docker/dockerfile:1

# ---------- 1 · compila la app (React + Vite)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY client ./client
RUN npm run build

# ---------- 2 · imagen final: solo el servidor, la app compilada y Express
FROM node:24-alpine
# tzdata: horas de la jornada en Colombia · su-exec: arrancar sin permisos de root
RUN apk add --no-cache tzdata su-exec
ENV NODE_ENV=production \
    TZ=America/Bogota \
    PORT=3000 \
    SABOR_DATA=/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
# por si el archivo llegó con finales de línea de Windows
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
 && chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /data && chown node:node /data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
