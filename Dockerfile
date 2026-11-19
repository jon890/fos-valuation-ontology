# 웹 빌드, API 빌드, 실행 이미지를 한 파일에서 만든다. 빌드 컨텍스트는 저장소 루트다.

# 베이스 이미지는 태그와 함께 digest 로 고정한다(2026-11-19 pull 로 확인한 index digest)
FROM node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM eclipse-temurin:21.0.13_9-jdk-noble@sha256:a2e61ec9e2e4d5c7aa885412400319f9299abe4d8189f42ec3bec48708c576a6 AS api
WORKDIR /src/api
COPY api/gradlew api/settings.gradle.kts api/build.gradle.kts ./
COPY api/gradle gradle
RUN ./gradlew --no-daemon -q dependencies > /dev/null
COPY ontology /src/ontology
COPY api/src src
RUN ./gradlew --no-daemon -q bootJar

FROM eclipse-temurin:21.0.13_9-jre-noble@sha256:977602aad3cf25b74bbb4c8e7532060eef80e1f1288932da35f5fbecd6159b65
# 고정한 기반 이미지 이후에 나온 OS 보안 패치도 실행 이미지에 반영한다.
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --no-create-home workbench
WORKDIR /app
COPY --from=api /src/api/build/libs/*.jar /app/app.jar
COPY --from=web /src/web/dist /app/static
USER workbench
ENV SPRING_PROFILES_ACTIVE=prod \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
