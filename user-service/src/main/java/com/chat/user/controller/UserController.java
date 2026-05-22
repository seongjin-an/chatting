package com.chat.user.controller;

import com.chat.common.response.ApiResponse;
import com.chat.user.dto.UserResponse;
import com.chat.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * 서비스 간 내부 호출용 (Feign Client).
     * Gateway 를 거치지 않는 내부 트래픽 전용이므로 인증 검사를 별도로 하지 않는다.
     */
    @GetMapping("/{userId}")
    public ApiResponse<UserResponse> getUser(@PathVariable UUID userId) {
        return ApiResponse.ok(userService.getUserById(userId));
    }
}
