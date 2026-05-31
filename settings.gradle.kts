pluginManagement {
    repositories {
        mavenLocal()
        gradlePluginPortal()
        mavenCentral()
    }
}

rootProject.name = "chat-msa"

include(
    "common",
    "eureka-server",
    "api-gateway",
    "user-service",
)

include("connection-service")
include("message-service")