const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class ChatService {
    constructor() {
        this.messages = [];
        this.maxMessages = parseInt(process.env.MAX_STORED_MESSAGES) || 1000;
    }

    createMessage(data) {
        const message = {
            id: uuidv4(),
            senderId: data.senderId,
            senderName: data.senderName,
            content: data.content,
            type: data.type || 'text',
            timestamp: Date.now(),
            serverId: process.env.SERVER_ID || 'default'
        };

        // Add message to storage
        this.messages.push(message);

        // Keep only the last N messages
        if (this.messages.length > this.maxMessages) {
            this.messages = this.messages.slice(-this.maxMessages);
        }

        return message;
    }

    createSystemMessage(content, type = 'system') {
        return this.createMessage({
            senderId: 'system',
            senderName: 'Sistem',
            content,
            type
        });
    }

    getRecentMessages(limit = 50) {
        const startIndex = Math.max(0, this.messages.length - limit);
        return this.messages.slice(startIndex).map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp).toISOString()
        }));
    }

    getMessagesByTimeRange(startTime, endTime) {
        return this.messages.filter(msg => 
            msg.timestamp >= startTime && msg.timestamp <= endTime
        );
    }

    getMessagesByUser(userId, limit = 100) {
        return this.messages
            .filter(msg => msg.senderId === userId)
            .slice(-limit);
    }

    getTotalMessageCount() {
        return this.messages.length;
    }

    getMessagesInLastHour() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        return this.messages.filter(msg => msg.timestamp > oneHourAgo);
    }

    getMessageStats() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * oneHour;

        return {
            total: this.messages.length,
            lastHour: this.messages.filter(msg => (now - msg.timestamp) < oneHour).length,
            last24Hours: this.messages.filter(msg => (now - msg.timestamp) < oneDay).length,
            byType: this.messages.reduce((acc, msg) => {
                acc[msg.type] = (acc[msg.type] || 0) + 1;
                return acc;
            }, {}),
            topUsers: this.getTopMessageUsers(10)
        };
    }

    getTopMessageUsers(limit = 10) {
        const userCounts = this.messages.reduce((acc, msg) => {
            if (msg.senderId !== 'system') {
                acc[msg.senderId] = acc[msg.senderId] || { 
                    userId: msg.senderId, 
                    username: msg.senderName, 
                    count: 0 
                };
                acc[msg.senderId].count++;
            }
            return acc;
        }, {});

        return Object.values(userCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    searchMessages(query, limit = 100) {
        const searchRegex = new RegExp(query, 'i');
        return this.messages
            .filter(msg => 
                searchRegex.test(msg.content) || 
                searchRegex.test(msg.senderName)
            )
            .slice(-limit);
    }

    deleteMessage(messageId, deletedBy) {
        const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
            const deletedMessage = this.messages[messageIndex];
            this.messages.splice(messageIndex, 1);
            
            // Create deletion log message
            this.createSystemMessage(
                `Mesaj silindi: "${deletedMessage.content.substring(0, 50)}..." (${deletedBy} tarafından)`,
                'deletion'
            );
            
            return true;
        }
        return false;
    }

    editMessage(messageId, newContent, editedBy) {
        const message = this.messages.find(msg => msg.id === messageId);
        if (message && message.senderId === editedBy) {
            const oldContent = message.content;
            message.content = newContent;
            message.editedAt = Date.now();
            message.edited = true;
            
            return { success: true, oldContent, newContent };
        }
        return { success: false, reason: 'Message not found or not authorized' };
    }

    cleanOldMessages(maxAgeHours = 24) {
        const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        const initialCount = this.messages.length;
        
        this.messages = this.messages.filter(msg => msg.timestamp > cutoffTime);
        
        const cleanedCount = initialCount - this.messages.length;
        return cleanedCount;
    }

    exportMessages(format = 'json') {
        const data = {
            serverName: process.env.SERVER_NAME || 'Unknown Server',
            exportTime: new Date().toISOString(),
            totalMessages: this.messages.length,
            messages: this.messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp).toISOString()
            }))
        };

        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(data, null, 2);
            case 'csv':
                return this.convertToCSV(data.messages);
            case 'txt':
                return this.convertToText(data.messages);
            default:
                return JSON.stringify(data, null, 2);
        }
    }

    convertToCSV(messages) {
        const headers = ['ID', 'Sender', 'Content', 'Type', 'Timestamp'];
        const rows = messages.map(msg => [
            msg.id,
            msg.senderName,
            `"${msg.content.replace(/"/g, '""')}"`,
            msg.type,
            new Date(msg.timestamp).toISOString()
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    convertToText(messages) {
        return messages.map(msg => {
            const timestamp = moment(msg.timestamp).format('YYYY-MM-DD HH:mm:ss');
            return `[${timestamp}] ${msg.senderName}: ${msg.content}`;
        }).join('\n');
    }

    // Message filtering and moderation
    filterMessage(content) {
        // Basic profanity filter (extend as needed)
        const badWords = process.env.BANNED_WORDS?.split(',') || [];
        let filtered = content;

        badWords.forEach(word => {
            const regex = new RegExp(word.trim(), 'gi');
            filtered = filtered.replace(regex, '*'.repeat(word.length));
        });

        return {
            original: content,
            filtered: filtered,
            wasFiltered: content !== filtered
        };
    }

    // Rate limiting for messages
    checkMessageRate(userId, windowMs = 60000, maxMessages = 10) {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        const recentMessages = this.messages.filter(msg => 
            msg.senderId === userId && 
            msg.timestamp > windowStart &&
            msg.type !== 'system'
        );

        return {
            count: recentMessages.length,
            limit: maxMessages,
            exceeded: recentMessages.length >= maxMessages,
            resetTime: windowStart + windowMs
        };
    }
}

module.exports = ChatService;