package com.chat.message.service.channel;

import com.chat.message.domain.ChannelEntity;
import lombok.Getter;

@Getter
public class CreateChannel {
    private final String title;

    private CreateChannel(String title) {
        this.title = title;
    }

    public static CreateChannel of(String title) {
        return new CreateChannel(title);
    }

    public ChannelEntity toEntity() {
        return ChannelEntity.of(title);
    }
}
