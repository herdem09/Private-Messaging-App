// MongoDB initialization script for ServerChat
// This script runs when MongoDB container starts for the first time

// Create main database
db = db.getSiblingDB('serverchat-main');

// Create admin user
db.createUser({
  user: 'serverchat_admin',
  pwd: 'secure_password_123',
  roles: [
    {
      role: 'readWrite',
      db: 'serverchat-main'
    }
  ]
});

// Create collections with validation
db.createCollection('servers', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'ipAddress', 'port'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 3,
          maxLength: 50,
          description: 'Server name must be a string between 3-50 characters'
        },
        ipAddress: {
          bsonType: 'string',
          pattern: '^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$',
          description: 'Must be a valid IPv4 address'
        },
        port: {
          bsonType: 'int',
          minimum: 1,
          maximum: 65535,
          description: 'Port must be between 1-65535'
        },
        hasPassword: {
          bsonType: 'bool',
          description: 'Boolean indicating if server has password'
        },
        maxUsers: {
          bsonType: 'int',
          minimum: 1,
          maximum: 1000,
          description: 'Maximum users must be between 1-1000'
        },
        currentUsers: {
          bsonType: 'int',
          minimum: 0,
          description: 'Current users must be non-negative'
        },
        isOnline: {
          bsonType: 'bool',
          description: 'Boolean indicating if server is online'
        },
        lastPing: {
          bsonType: 'date',
          description: 'Last ping timestamp'
        },
        totalConnections: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total connections must be non-negative'
        },
        totalMessages: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total messages must be non-negative'
        },
        description: {
          bsonType: 'string',
          maxLength: 200,
          description: 'Server description max 200 characters'
        },
        tags: {
          bsonType: 'array',
          items: {
            bsonType: 'string',
            maxLength: 20
          },
          description: 'Array of tags, each max 20 characters'
        },
        bannedDevices: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['deviceId', 'bannedAt', 'banExpiry'],
            properties: {
              deviceId: {
                bsonType: 'string',
                description: 'Device ID that is banned'
              },
              bannedAt: {
                bsonType: 'date',
                description: 'When the ban was issued'
              },
              banExpiry: {
                bsonType: 'date',
                description: 'When the ban expires'
              },
              reason: {
                bsonType: 'string',
                maxLength: 200,
                description: 'Reason for ban'
              }
            }
          },
          description: 'Array of banned devices'
        },
        ownerInfo: {
          bsonType: 'object',
          properties: {
            contactEmail: {
              bsonType: 'string',
              pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
              description: 'Valid email address'
            },
            contactDiscord: {
              bsonType: 'string',
              maxLength: 50,
              description: 'Discord contact info'
            }
          },
          description: 'Server owner contact information'
        }
      }
    }
  }
});

// Create indexes for performance
db.servers.createIndex({ 'ipAddress': 1, 'port': 1 }, { unique: true });
db.servers.createIndex({ 'isOnline': 1 });
db.servers.createIndex({ 'createdAt': -1 });
db.servers.createIndex({ 'lastPing': 1 });
db.servers.createIndex({ 'currentUsers': -1 });
db.servers.createIndex({ 'totalConnections': -1 });
db.servers.createIndex({ 'name': 'text', 'description': 'text', 'tags': 'text' });

// Create server stats collection for analytics
db.createCollection('server_stats', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['serverId', 'timestamp'],
      properties: {
        serverId: {
          bsonType: 'objectId',
          description: 'Reference to server'
        },
        timestamp: {
          bsonType: 'date',
          description: 'When stats were recorded'
        },
        userCount: {
          bsonType: 'int',
          minimum: 0,
          description: 'Number of users at this time'
        },
        messageCount: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total messages at this time'
        },
        memoryUsage: {
          bsonType: 'object',
          properties: {
            rss: { bsonType: 'number' },
            heapTotal: { bsonType: 'number' },
            heapUsed: { bsonType: 'number' },
            external: { bsonType: 'number' }
          },
          description: 'Memory usage statistics'
        },
        cpuUsage: {
          bsonType: 'object',
          properties: {
            user: { bsonType: 'number' },
            system: { bsonType: 'number' }
          },
          description: 'CPU usage statistics'
        }
      }
    }
  }
});

// Index for server stats
db.server_stats.createIndex({ 'serverId': 1, 'timestamp': -1 });
db.server_stats.createIndex({ 'timestamp': -1 });

// Create system logs collection
db.createCollection('system_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['level', 'message', 'timestamp'],
      properties: {
        level: {
          bsonType: 'string',
          enum: ['error', 'warn', 'info', 'debug'],
          description: 'Log level'
        },
        message: {
          bsonType: 'string',
          maxLength: 1000,
          description: 'Log message'
        },
        timestamp: {
          bsonType: 'date',
          description: 'When log was created'
        },
        serverId: {
          bsonType: 'objectId',
          description: 'Server that generated the log'
        },
        metadata: {
          bsonType: 'object',
          description: 'Additional log metadata'
        }
      }
    }
  }
});

// Index for system logs
db.system_logs.createIndex({ 'timestamp': -1 });
db.system_logs.createIndex({ 'level': 1, 'timestamp': -1 });
db.system_logs.createIndex({ 'serverId': 1, 'timestamp': -1 });

// Insert sample data for testing
db.servers.insertMany([
  {
    name: 'General Chat',
    ipAddress: '192.168.1.100',
    port: 8080,
    hasPassword: false,
    maxUsers: 100,
    currentUsers: 0,
    isOnline: false,
    lastPing: new Date(),
    totalConnections: 0,
    totalMessages: 0,
    description: 'A general chat server for everyone',
    tags: ['general', 'public', 'friendly'],
    bannedDevices: [],
    ownerInfo: {
      contactEmail: 'admin@example.com'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Gaming Hub',
    ipAddress: '192.168.1.101',
    port: 8080,
    hasPassword: true,
    password: '$2a$10$example.hash.here', // bcrypt hash
    maxUsers: 50,
    currentUsers: 0,
    isOnline: false,
    lastPing: new Date(),
    totalConnections: 0,
    totalMessages: 0,
    description: 'Chat server for gamers',
    tags: ['gaming', 'private', 'competitive'],
    bannedDevices: [],
    ownerInfo: {
      contactEmail: 'gaming@example.com',
      contactDiscord: 'gamer#1234'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Create TTL index for old stats (keep for 30 days)
db.server_stats.createIndex({ 'timestamp': 1 }, { expireAfterSeconds: 2592000 });

// Create TTL index for old logs (keep for 7 days)
db.system_logs.createIndex({ 'timestamp': 1 }, { expireAfterSeconds: 604800 });

print('✅ ServerChat database initialized successfully');
print('📊 Created collections: servers, server_stats, system_logs');
print('🔍 Created indexes for optimal performance');
print('👤 Created admin user: serverchat_admin');
print('📝 Inserted sample server data');
print('🗑️  Configured TTL for automatic cleanup');

// Show collection stats
print('\n📈 Collection Statistics:');
print('Servers:', db.servers.countDocuments());
print('Server Stats:', db.server_stats.countDocuments());
print('System Logs:', db.system_logs.countDocuments());