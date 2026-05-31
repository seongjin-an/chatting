package com.chat.message.service.channelmember;

import com.chat.message.domain.ChannelMemberEntity;
import com.chat.message.repository.channelmember.ChannelMemberRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
@Service
public class ChannelMemberService {

    private final ChannelMemberRepository channelMemberRepository;

    @Transactional
    public void createChannelMember(ChannelMemberDto dto) {
        ChannelMemberEntity entity = dto.toEntity();
        channelMemberRepository.save(entity);
    }

    @Transactional
    public void removeChannelMember(ChannelMemberDto dto) {
        channelMemberRepository.deleteByChannelIdAndUserId(dto.getChannelId(), UUID.fromString(dto.getUserId()));
    }

    public List<ChannelMember> getChannelMembers(Long channelId) {
        List<ChannelMemberEntity> channelMembers = channelMemberRepository.findByChannelId(channelId);
        return channelMembers.stream()
            .map(ChannelMember::of)
            .toList();
    }
}
