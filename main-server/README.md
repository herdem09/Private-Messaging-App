# ServerChat Ana Sunucusu

Bu, ServerChat uygulamasının ana sunucusudur. Tüm chat sunucularının kayıtlarını yönetir ve koordine eder.

## Özellikler

- 🖥️ **Sunucu Yönetimi**: Chat sunucularının kayıt ve yönetimi
- 📊 **İstatistikler**: Sunucu ve kullanıcı istatistikleri
- 🔍 **Sunucu Arama**: İsim ve açıklamaya göre sunucu arama
- 🏥 **Health Check**: Sunucu durumu kontrolü
- 📈 **Monitoring**: Detaylı izleme ve loglama
- 🔒 **Güvenlik**: Rate limiting, validation ve güvenlik önlemleri

## Kurulum

### Gereksinimler
- Node.js 16+
- MongoDB 4.4+
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

3. **MongoDB'yi başlatın:**
   ```bash
   # Yerel MongoDB
   mongod
   
   # Veya Docker ile
   docker run -d -p 27017:27017 --name mongodb mongo:6.0
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
# Tüm servisleri başlat (MongoDB dahil)
docker-compose up -d

# Sadece ana sunucuyu build et
docker build -t serverchat-main .
docker run -p 3000:3000 serverchat-main
```

## API Endpoints

### Sunucu Yönetimi

#### `GET /api/servers`
Tüm aktif sunucuları listeler.

**Query Parameters:**
- `page` (int): Sayfa numarası (varsayılan: 1)
- `limit` (int): Sayfa başına kayıt (varsayılan: 20)
- `sort` (string): Sıralama (popular, newest, name)

**Response:**
```json
{
  "servers": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### `POST /api/servers/register`
Yeni sunucu kaydeder.

**Request Body:**
```json
{
  "name": "Awesome Server",
  "ipAddress": "192.168.1.100",
  "port": 8080,
  "password": "optional_password",
  "maxUsers": 100,
  "description": "Server açıklaması"
}
```

#### `GET /api/servers/:id`
Belirli bir sunucunun detaylarını getirir.

#### `POST /api/servers/:id/ping`
Sunucu durumunu günceller (sunucular tarafından kullanılır).

### İstatistikler

#### `GET /api/servers/stats/overview`
Genel sunucu istatistiklerini getirir.

### Health Check

#### `GET /api/health`
Temel health check.

#### `GET /api/health/detailed`
Detaylı sistem durumu.

## Konfigürasyon

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/serverchat-main

# Security
ALLOWED_ORIGINS=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Rate Limiting

- **Genel**: 100 istek/15 dakika
- **Sunucu Kayıt**: 5 kayıt/saat

## Monitoring ve Logging

### Log Dosyaları
- `logs/YYYY-MM-DD.log`: Genel loglar
- `logs/YYYY-MM-DD-error.log`: Hata logları

### Health Monitoring
- `/api/health`: Temel durum kontrolü
- `/api/health/detailed`: Detaylı sistem bilgileri

### Metrics
- Toplam sunucu sayısı
- Aktif sunucu sayısı
- Toplam kullanıcı sayısı
- Sistem kaynak kullanımı

## Güvenlik

### Implemented Security Measures
- **Helmet.js**: HTTP header güvenliği
- **Rate Limiting**: DDoS koruması
- **Input Validation**: Giriş doğrulama
- **CORS**: Cross-origin istek kontrolü
- **Error Handling**: Güvenli hata mesajları

### Best Practices
- Şifreler bcrypt ile hash'lenir
- Sensitive bilgiler loglanmaz
- Input validation ve sanitization
- MongoDB injection koruması

## Geliştirme

### Proje Yapısı
```
src/
├── models/          # MongoDB modelleri
├── routes/          # Express route'ları
├── services/        # İş mantığı servisleri
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

### Testing
```bash
# Unit testler
npm test

# Test coverage
npm run test:coverage
```

## Deployment

### Production Checklist
- [ ] Environment variables ayarlandı
- [ ] MongoDB bağlantısı test edildi
- [ ] Rate limiting konfigüre edildi
- [ ] CORS ayarları yapıldı
- [ ] Log dizinleri oluşturuldu
- [ ] Health check endpoints test edildi

### Docker Deployment
```bash
# Build
docker build -t serverchat-main .

# Run
docker run -d \
  -p 3000:3000 \
  -e MONGODB_URI=mongodb://mongo:27017/serverchat-main \
  --name serverchat-main \
  serverchat-main
```

### Kubernetes Deployment
```yaml
# Kubernetes manifests examples in k8s/ directory
kubectl apply -f k8s/
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - MongoDB servisinin çalıştığından emin olun
   - MONGODB_URI'nin doğru olduğunu kontrol edin

2. **Port Already in Use**
   - PORT environment variable'ını değiştirin
   - Çakışan servisleri durdurun

3. **Rate Limit Errors**
   - Rate limit ayarlarını kontrol edin
   - IP whitelist kullanın

### Debug Mode
```bash
DEBUG=true npm run dev
```

## Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun
3. Testleri çalıştırın
4. Pull request gönderin

## Lisans

MIT