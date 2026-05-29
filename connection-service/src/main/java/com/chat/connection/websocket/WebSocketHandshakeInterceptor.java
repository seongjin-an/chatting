package com.chat.connection.websocket;

import com.chat.common.Constant;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Slf4j
public class WebSocketHandshakeInterceptor implements HandshakeInterceptor {


    public static final String X_USER_ID = "X-User-Id";

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
        WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {

        String userIdHeader = request.getHeaders().getFirst(X_USER_ID);
        log.info("[BeforeHandshake] {}", userIdHeader);
        if (userIdHeader == null) {
            return false;
        }

        attributes.put(Constant.USER_ID, userIdHeader);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
        WebSocketHandler wsHandler, Exception exception) {

    }
}
