// 순수 라이브러리 — Spring Boot 플러그인 미적용 (실행 가능 jar 불필요)
// java-library: api() 설정으로 의존성이 소비자(각 서비스)에게 전이됨
plugins {
    id("java-library")
}

dependencies {
    api("org.springframework.boot:spring-boot-starter-web")
    api("org.springframework.boot:spring-boot-starter-data-jpa")
    api("org.springframework.boot:spring-boot-starter-security")
    api("org.springframework.boot:spring-boot-starter-validation")
}
