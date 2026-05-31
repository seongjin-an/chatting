package com.chat.message.repository.channel;

import com.chat.message.domain.ChannelEntity;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ChannelRepository extends JpaRepository<ChannelEntity, Long> {

    @Query("""
        SELECT CH.channelId, CH.title
        FROM ChannelEntity CH
        JOIN ChannelMemberEntity CM ON (CH.channelId = CM.channelId)
        WHERE CM.userId = :userId
    """)
    Page<ChannelProjection> findMyChannelsByUserId(UUID userId, Pageable pageable);
}
