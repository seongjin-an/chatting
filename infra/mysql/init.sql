CREATE DATABASE IF NOT EXISTS chatting
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS chat_message
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON chatting.*     TO 'dev_user'@'%';
GRANT ALL PRIVILEGES ON chat_message.* TO 'dev_user'@'%';
FLUSH PRIVILEGES;
