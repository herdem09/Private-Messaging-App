const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 50
    },
    ipAddress: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                // IP address validation
                const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                return ipRegex.test(v);
            },
            message: 'Geçersiz IP adresi formatı'
        }
    },
    port: {
        type: Number,
        required: true,
        min: 1,
        max: 65535
    },
    hasPassword: {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        select: false // Don't include in queries by default
    },
    maxUsers: {
        type: Number,
        default: 100,
        min: 1,
        max: 1000
    },
    currentUsers: {
        type: Number,
        default: 0,
        min: 0
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastPing: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    // Server statistics
    totalConnections: {
        type: Number,
        default: 0
    },
    totalMessages: {
        type: Number,
        default: 0
    },
    // Server metadata
    description: {
        type: String,
        maxlength: 200,
        default: ''
    },
    tags: [{
        type: String,
        maxlength: 20
    }],
    // Ban list for this server
    bannedDevices: [{
        deviceId: String,
        bannedAt: Date,
        banExpiry: Date,
        reason: String
    }],
    // Server owner info
    ownerInfo: {
        contactEmail: String,
        contactDiscord: String
    }
}, {
    timestamps: true
});

// Indexes for performance
serverSchema.index({ ipAddress: 1, port: 1 }, { unique: true });
serverSchema.index({ isOnline: 1 });
serverSchema.index({ createdAt: -1 });
serverSchema.index({ lastPing: 1 });

// Virtual for full address
serverSchema.virtual('fullAddress').get(function() {
    return `${this.ipAddress}:${this.port}`;
});

// Virtual for user percentage
serverSchema.virtual('userPercentage').get(function() {
    return Math.round((this.currentUsers / this.maxUsers) * 100);
});

// Pre-save middleware
serverSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Methods
serverSchema.methods.ping = function() {
    this.lastPing = new Date();
    this.isOnline = true;
    return this.save();
};

serverSchema.methods.setOffline = function() {
    this.isOnline = false;
    this.currentUsers = 0;
    return this.save();
};

serverSchema.methods.updateUserCount = function(count) {
    this.currentUsers = Math.max(0, Math.min(count, this.maxUsers));
    return this.save();
};

serverSchema.methods.incrementStats = function(messages = 0, connections = 0) {
    this.totalMessages += messages;
    this.totalConnections += connections;
    return this.save();
};

serverSchema.methods.banDevice = function(deviceId, reason = 'Kural ihlali', durationMinutes = 30) {
    const banExpiry = new Date(Date.now() + (durationMinutes * 60 * 1000));
    
    // Remove existing ban if any
    this.bannedDevices = this.bannedDevices.filter(ban => ban.deviceId !== deviceId);
    
    // Add new ban
    this.bannedDevices.push({
        deviceId,
        bannedAt: new Date(),
        banExpiry,
        reason
    });
    
    return this.save();
};

serverSchema.methods.unbanDevice = function(deviceId) {
    this.bannedDevices = this.bannedDevices.filter(ban => ban.deviceId !== deviceId);
    return this.save();
};

serverSchema.methods.isDeviceBanned = function(deviceId) {
    const ban = this.bannedDevices.find(ban => 
        ban.deviceId === deviceId && ban.banExpiry > new Date()
    );
    return ban || null;
};

// Static methods
serverSchema.statics.findByAddress = function(ipAddress, port) {
    return this.findOne({ ipAddress, port });
};

serverSchema.statics.findOnlineServers = function() {
    return this.find({ isOnline: true }).sort({ currentUsers: -1 });
};

serverSchema.statics.findPopularServers = function(limit = 10) {
    return this.find({ isOnline: true })
        .sort({ currentUsers: -1, totalConnections: -1 })
        .limit(limit);
};

// Transform output
serverSchema.set('toJSON', {
    transform: function(doc, ret) {
        delete ret.__v;
        delete ret.password;
        delete ret.bannedDevices;
        return ret;
    }
});

module.exports = mongoose.model('Server', serverSchema);