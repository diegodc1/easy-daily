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

FROM maven:3.9.9-eclipse-temurin-17 AS builder
WORKDIR /app

COPY --from=source /src/backend/pom.xml ./
RUN mvn dependency:go-offline

COPY --from=source /src/backend/src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar", "--spring.profiles.active=dev,docker"]
