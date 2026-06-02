package com.chat.fanout;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {"com.chat"})
public class FanoutServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(FanoutServiceApplication.class, args);
    }
}
