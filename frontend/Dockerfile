FROM alpine/git:2.47.2 AS source
WORKDIR /src

ARG GIT_REPO_URL=https://github.com/diegodc1/easy-daily.git
ARG GIT_BRANCH=main
ARG GIT_USERNAME=
ARG GIT_PASSWORD=

RUN if [ -n "$GIT_USERNAME" ] && [ -n "$GIT_PASSWORD" ]; then \
      git clone --branch "$GIT_BRANCH" "https://${GIT_USERNAME}:${GIT_PASSWORD}@${GIT_REPO_URL#https://}" .; \
    else \
      git clone --branch "$GIT_BRANCH" "$GIT_REPO_URL" .; \
    fi

FROM node:20-alpine AS build
WORKDIR /app

COPY --from=source /src/frontend/package*.json ./
RUN npm ci

COPY --from=source /src/frontend ./
RUN npm run build:prod

FROM nginx:1.27-alpine
ENV BACKEND_URL=http://backend:8080

COPY --from=source /src/frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/daily-frontend/browser /usr/share/nginx/html

EXPOSE 80
