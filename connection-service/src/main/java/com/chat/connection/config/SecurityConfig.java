package com.chat.connection.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;

@EnableWebSecurity
@Configuration
public class SecurityConfig {

    @Bean
    public WebSecurityCustomizer webSecurityCustomizer() {
        // WebSocket upgrade 요청이 Security 필터 체인을 완전히 우회하도록 설정
        // permitAll()은 필터 체인을 통과시키지만 101 Switching Protocols 응답을 방해할 수 있음
        return web -> web.ignoring().requestMatchers("/**");
    }
}
