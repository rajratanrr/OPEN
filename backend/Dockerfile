FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY backend/pom.xml .
RUN mvn -B dependency:go-offline
COPY backend/src ./src
RUN mvn -B verify

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl fontconfig fonts-dejavu-core && rm -rf /var/lib/apt/lists/* && useradd --system --uid 10001 --create-home roadsaathi && mkdir -p /data/evidence && chown -R roadsaathi /data
WORKDIR /app
COPY --from=build /build/target/roadsaathi-api-1.0.0.jar app.jar
USER roadsaathi
EXPOSE 8080
ENTRYPOINT ["java","-Djava.awt.headless=true","-XX:MaxRAMPercentage=70","-jar","app.jar"]
