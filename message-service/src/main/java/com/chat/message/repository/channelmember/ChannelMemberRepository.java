package com.chat.message.repository.channelmember;

import com.chat.message.domain.ChannelMemberEntity;
import com.chat.message.domain.ChannelMemberEntity.ChannelMemberEntityId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChannelMemberRepository extends JpaRepository<ChannelMemberEntity, ChannelMemberEntityId> {

    List<ChannelMemberEntity> findByChannelId(Long channelId);

    void deleteByChannelIdAndUserId(Long channelId, UUID userId);
}
