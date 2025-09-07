# ServerChat Chat Sunucusu

Bu, ServerChat uygulamasının örnek chat sunucusudur. Real-time WebSocket bağlantıları ile mesajlaşma sağlar.

## Özellikler

- 💬 **Real-time Chat**: Socket.IO ile anlık mesajlaşma
- 👥 **Kullanıcı Yönetimi**: Online kullanıcı takibi ve yönetimi
- 🔒 **Güvenlik**: Spam koruması, ban sistemi, rate limiting
- 🔐 **Kimlik Doğrulama**: JWT tabanlı authentication
- 📊 **İstatistikler**: Detaylı kullanıcı ve mesaj istatistikleri
- 🛡️ **Admin Panel**: Sunucu yönetimi için admin endpoints
- 🔗 **Ana Sunucu Entegrasyonu**: Main server ile otomatik kayıt ve ping
- 📝 **Loglama**: Kapsamlı log sistemi

## Kurulum

### Gereksinimler
- Node.js 16+
- npm veya yarn

### Hızlı Başlangıç

1. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

2. **Environment dosyasını oluşturun:**
   ```bash
   cp .env.example .env
   ```

3. **Environment değişkenlerini düzenleyin:**
   ```env
   SERVER_NAME=My Chat Server
   SERVER_PASSWORD=your-password
   MAX_USERS=100
   MAIN_SERVER_URL=http://localhost:3000
   ADMIN_KEY=your-admin-key
   ```

4. **Sunucuyu başlatın:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

### Docker ile Kurulum

```bash
# Tek sunucu
docker build -t serverchat-chat .
docker run -p 8080:8080 \
  -e SERVER_NAME="My Chat Server" \
  -e MAIN_SERVER_URL="http://main-server:3000" \
  serverchat-chat

# Tüm sistem (main server dahil)
docker-compose up -d
```

## API Endpoints

### Kimlik Doğrulama

#### `POST /api/auth/connect`
Sunucuya bağlanmak için kimlik doğrulama.

**Request Body:**
```json
{
  "username": "kullanici123",
  "password": "sunucu_sifresi",
  "deviceId": "unique-device-id"
}
```

#### `POST /api/auth/guest`
Misafir olarak bağlanma (şifre gerektirmez).

#### `GET /api/auth/server-info`
Sunucu bilgilerini alma.

### Health Check

#### `GET /api/health`
Temel sunucu durumu.

#### `GET /api/health/detailed`
Detaylı sistem durumu ve istatistikler.

### Admin Panel

#### `GET /api/admin/dashboard`
Admin dashboard verileri.

#### `GET /api/admin/users`
Tüm kullanıcıları listele.

#### `POST /api/admin/users/:socketId/kick`
Kullanıcı at.

#### `POST /api/admin/users/:socketId/mute`
Kullanıcı sustur.

#### `GET /api/admin/messages`
Mesajları listele/ara.

#### `DELETE /api/admin/messages/:messageId`
Mesaj sil.

#### `GET /api/admin/bans`
Ban listesi.

#### `POST /api/admin/bans`
Cihaz banla.

## WebSocket Events

### Client → Server

#### `auth`
Kimlik doğrulama.
```javascript
socket.emit('auth', {
  token: 'jwt-token',
  username: 'username',
  deviceId: 'device-id'
});
```

#### `message`
Mesaj gönderme.
```javascript
socket.emit('message', {
  content: 'Merhaba!',
  type: 'text'
});
```

#### `typing_start` / `typing_stop`
Yazma durumu bildirimi.

### Server → Client

#### `auth_success` / `auth_error`
Kimlik doğrulama sonucu.

#### `message`
Yeni mesaj.
```javascript
{
  id: 'message-id',
  senderId: 'user-id',
  senderName: 'username',
  content: 'message content',
  timestamp: '2023-01-01T00:00:00.000Z',
  type: 'text'
}
```

#### `user_joined` / `user_left`
Kullanıcı giriş/çıkış bildirimleri.

#### `user_list`
Çevrimiçi kullanıcı listesi.

#### `user_typing`
Yazma durumu bildirimi.

## Konfigürasyon

### Environment Variables

```env
# Server Basics
SERVER_NAME=My Chat Server
SERVER_DESCRIPTION=A friendly chat server
PORT=8080
MAX_USERS=100

# Authentication
SERVER_PASSWORD=your-password
JWT_SECRET=your-jwt-secret
ADMIN_KEY=your-admin-key

# Main Server Integration
MAIN_SERVER_URL=http://localhost:3000
SERVER_ID=auto-generated
SERVER_TOKEN=optional

# Security
SPAM_MESSAGES_PER_MINUTE=10
SPAM_BAN_DURATION=60
BANNED_WORDS=spam,bad,words
```

### Güvenlik Ayarları

- **Spam Koruması**: Dakikada maksimum mesaj sayısı
- **Ban Sistemi**: Otomatik ve manuel ban yönetimi
- **Rate Limiting**: API endpoint koruması
- **Content Filtering**: Yasaklı kelime filtresi

## Monitoring ve Yönetim

### Loglama
- `logs/YYYY-MM-DD.log`: Genel loglar
- `logs/YYYY-MM-DD-error.log`: Hata logları

### İstatistikler
- Online kullanıcı sayısı
- Mesaj istatistikleri
- Ban istatistikleri
- Sistem kaynak kullanımı

### Admin Panel
Admin key ile erişilebilen yönetim paneli:
- Kullanıcı yönetimi (kick, mute, ban)
- Mesaj yönetimi (silme, arama)
- Ban yönetimi
- Sistem istatistikleri
- Veri export

## Ana Sunucu Entegrasyonu

Chat sunucusu otomatik olarak ana sunucuya kaydolur ve durumunu bildirir:

1. **Otomatik Kayıt**: Başlangıçta ana sunucuya kayıt
2. **Periyodik Ping**: 30 saniyede bir durum güncelleme
3. **İstatistik Gönderimi**: Kullanıcı ve mesaj sayıları
4. **Health Check**: Ana sunucu durumu kontrolü

## Geliştirme

### Proje Yapısı
```
src/
├── services/        # İş mantığı servisleri
│   ├── ChatService.js
│   ├── UserService.js
│   ├── BanService.js
│   └── MainServerService.js
├── routes/          # Express route'ları
│   ├── auth.js
│   ├── health.js
│   └── admin.js
├── middleware/      # Custom middleware'ler
├── utils/           # Yardımcı fonksiyonlar
└── server.js        # Ana sunucu dosyası
```

### Scripts
```bash
npm run dev      # Development server (nodemon)
npm start        # Production server
npm test         # Test çalıştır
npm run lint     # ESLint kontrolü
```

### WebSocket Testing
```javascript
// Browser'da test için
const socket = io('http://localhost:8080');

socket.emit('auth', {
  username: 'test-user',
  deviceId: 'test-device-123'
});

socket.on('auth_success', (data) => {
  console.log('Connected:', data);
  
  socket.emit('message', {
    content: 'Hello, world!'
  });
});
```

## Deployment

### Production Checklist
- [ ] Environment variables ayarlandı
- [ ] Ana sunucu URL'si konfigüre edildi
- [ ] Admin key güçlü şifre ile ayarlandı
- [ ] JWT secret güvenli şekilde oluşturuldu
- [ ] Rate limiting ayarları yapıldı
- [ ] Log dizinleri oluşturuldu
- [ ] CORS ayarları yapıldı

### Docker Deployment
```bash
# Build
docker build -t my-chat-server .

# Run
docker run -d \
  -p 8080:8080 \
  -e SERVER_NAME="My Chat Server" \
  -e MAIN_SERVER_URL="http://main-server:3000" \
  -e ADMIN_KEY="secure-admin-key" \
  --name chat-server \
  my-chat-server
```

### Load Balancing
Nginx ile birden fazla chat sunucusu çalıştırabilirsiniz:

```nginx
upstream chat_servers {
    server chat-server-1:8080;
    server chat-server-2:8080;
    server chat-server-3:8080;
}

server {
    listen 80;
    location / {
        proxy_pass http://chat_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - CORS ayarlarını kontrol edin
   - Firewall kurallarını kontrol edin
   - Proxy ayarlarını kontrol edin

2. **Main Server Connection Failed**
   - MAIN_SERVER_URL'in doğru olduğunu kontrol edin
   - Ana sunucunun çalıştığını kontrol edin
   - Network bağlantısını test edin

3. **Authentication Errors**
   - JWT_SECRET'in tutarlı olduğunu kontrol edin
   - Token expiry sürelerini kontrol edin
   - Device ID formatını kontrol edin

4. **High Memory Usage**
   - MAX_STORED_MESSAGES değerini azaltın
   - Log cleanup ayarlarını kontrol edin
   - Memory leak için profiling yapın

### Debug Mode
```bash
DEBUG=true npm run dev
```

### Log Analysis
```bash
# Son 100 log satırını görüntüle
tail -n 100 logs/$(date +%Y-%m-%d).log

# Hata loglarını filtrele
grep "ERROR" logs/$(date +%Y-%m-%d).log

# Belirli kullanıcının loglarını bul
grep "username123" logs/$(date +%Y-%m-%d).log
```

## Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun
3. Testleri çalıştırın
4. Pull request gönderin

## Lisans

MIT