package com.chat.message.service.channel;

import com.chat.message.domain.ChannelEntity;
import com.chat.message.repository.channel.ChannelProjection;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.ToString;

@ToString
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Getter
public class Channel {
    private final Long channelId;
    private final String title;

    public static Channel from(ChannelEntity channelEntity) {
        return new Channel(channelEntity.getChannelId(), channelEntity.getTitle());
    }

    public static Channel from(ChannelProjection channelProjection) {
        return new Channel(channelProjection.getChannelId(), channelProjection.getTitle());
    }
}
