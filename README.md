# 🚀 ServerChat - Discord Benzeri Mesajlaşma Sistemi

ServerChat, kullanıcıların kendi sunucularını oluşturabileceği ve yönetebileceği Discord benzeri bir mesajlaşma platformudur. Sistem, Android uygulaması, ana sunucu ve dağıtık chat sunucularından oluşur.

## 📱 Proje Yapısı

```
ServerChat/
├── 📱 Android App/          # Kotlin ile yazılmış mobil uygulama
├── 🖥️  main-server/         # Ana sunucu (Node.js/Express/MongoDB)
├── 💬 chat-server/          # Chat sunucuları (Node.js/Socket.IO)
├── 🗄️  database/            # Veritabanı konfigürasyonları
├── 🐳 deployment/           # Docker ve deployment araçları
├── 🔧 nginx/               # Reverse proxy konfigürasyonu
├── 📊 monitoring/          # İzleme ve metrikler
└── 💾 backup/              # Yedekleme servisleri
```

## ✨ Özellikler

### 📱 Android Uygulaması
- **Modern UI**: Jetpack Compose ile Discord benzeri arayüz
- **Real-time Chat**: WebSocket ile anlık mesajlaşma
- **Sunucu Yönetimi**: Sunucu oluşturma ve katılma
- **Güvenlik**: Cihaz bazlı ban sistemi ve spam koruması
- **Bildirimler**: Arkaplan bildirimleri
- **Offline Support**: Yerel veri saklama

### 🖥️ Ana Sunucu
- **Sunucu Kaydı**: Chat sunucularının merkezi kaydı
- **API Gateway**: RESTful API servisleri
- **İstatistikler**: Gerçek zamanlı sunucu istatistikleri
- **Health Check**: Sunucu durumu izleme
- **Rate Limiting**: DDoS koruması

### 💬 Chat Sunucuları
- **WebSocket**: Real-time mesajlaşma
- **Kullanıcı Yönetimi**: Online kullanıcı takibi
- **Ban Sistemi**: Otomatik ve manuel ban yönetimi
- **Spam Koruması**: Mesaj hızı kontrolü
- **Admin Panel**: Web tabanlı yönetim arayüzü

### 🔒 Güvenlik
- **JWT Authentication**: Güvenli kimlik doğrulama
- **Rate Limiting**: API ve mesaj hızı kontrolü
- **Input Validation**: Girdi doğrulama ve sanitizasyon
- **Ban Management**: Cihaz ve IP bazlı banlama
- **Encryption**: Şifre hash'leme ve güvenli iletişim

## 🚀 Hızlı Başlangıç

### Gereksinimler
- **Docker & Docker Compose**: Containerization
- **Android Studio**: Mobil uygulama geliştirme
- **Node.js 16+**: Backend geliştirme (opsiyonel)
- **MongoDB**: Veritabanı
- **Redis**: Cache ve session yönetimi

### 1. Projeyi Klonlayın
```bash
git clone <repository-url>
cd ServerChat
```

### 2. Environment Konfigürasyonu
```bash
# Ana konfigürasyon dosyasını oluşturun
cp .env.example .env

# Güvenlik ayarlarını değiştirin
nano .env
```

### 3. Backend Sistemini Başlatın
```bash
# Tüm servisleri başlat (ana sunucu + chat sunucuları + veritabanları)
docker-compose -f docker-compose.full.yml up -d

# Veya deployment script ile
./deployment/deploy.sh deploy
```

### 4. Android Uygulamasını Çalıştırın
```bash
# Android Studio'da projeyi açın
# app/ klasörünü Android Studio'da açın
# Gradle sync tamamlandıktan sonra Run butonuna tıklayın
```

### 5. Durumu Kontrol Edin
```bash
# Servislerin durumunu kontrol et
./deployment/deploy.sh status

# Health check
curl http://localhost:3000/api/health
```

## 📋 Servisler ve Portlar

| Servis | Port | Açıklama |
|--------|------|----------|
| Ana Sunucu | 3000 | Main server API |
| General Chat | 8080 | Genel chat sunucusu |
| Gaming Hub | 8081 | Oyun chat sunucusu |
| Study Group | 8082 | Çalışma grubu |
| MongoDB | 27017 | Veritabanı |
| Redis | 6379 | Cache |
| Nginx | 80/443 | Reverse proxy |
| Mongo Express | 8090 | DB admin |
| Grafana | 3001 | Monitoring |

## 🏗️ Mimari

### Sistem Mimarisi
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Android App   │◄──►│   Nginx Proxy    │◄──►│   Main Server   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │              ┌─────────▼────────┐               │
         │              │  Chat Servers    │               │
         │              │ ┌──────────────┐ │               │
         └──────────────►│ │ General Chat │ │◄──────────────┘
                        │ │ Gaming Hub   │ │
                        │ │ Study Group  │ │
                        │ └──────────────┘ │
                        └──────────────────┘
                                 │
                        ┌────────▼────────┐
                        │   Databases     │
                        │ ┌─────────────┐ │
                        │ │  MongoDB    │ │
                        │ │  Redis      │ │
                        │ └─────────────┘ │
                        └─────────────────┘
```

### Data Flow
1. **Android App** → Ana sunucuya kayıt olur
2. **Ana Sunucu** → Kullanılabilir chat sunucularını listeler
3. **Android App** → Chat sunucusuna bağlanır
4. **Chat Sunucu** → Ana sunucuya durumunu bildirir
5. **WebSocket** → Real-time mesajlaşma

## 🛠️ Geliştirme

### Android Uygulaması
```bash
cd app/
# Android Studio ile açın veya
./gradlew assembleDebug
```

### Backend Servisleri
```bash
# Ana sunucu
cd main-server/
npm install
npm run dev

# Chat sunucusu
cd chat-server/
npm install
npm run dev
```

### Veritabanı
```bash
cd database/
./database-setup.sh setup
```

## 📊 Monitoring ve İzleme

### Grafana Dashboard
- **URL**: http://localhost:3001
- **Login**: admin / (GRAFANA_PASSWORD)
- **Dashboards**: Sistem metrikleri, chat istatistikleri

### Prometheus Metrics
- **URL**: http://localhost:9090
- **Metrics**: Uygulama ve sistem metrikleri

### Log Aggregation
```bash
# Tüm logları görüntüle
docker-compose -f docker-compose.full.yml logs -f

# Belirli servis logları
docker-compose -f docker-compose.full.yml logs -f main-server
```

## 💾 Backup ve Restore

### Otomatik Backup
```bash
# Backup servisini aktifleştir
docker-compose -f docker-compose.full.yml --profile backup up -d

# Manuel backup
./database/backup-restore.sh backup --compress
```

### Restore İşlemi
```bash
# Backup'ları listele
./database/backup-restore.sh list

# Restore et
./database/backup-restore.sh restore backup-file.archive.gz
```

## 🚀 Production Deployment

### SSL/TLS Konfigürasyonu
```bash
# SSL sertifikaları
mkdir -p nginx/ssl/
# Sertifikalarınızı nginx/ssl/ klasörüne kopyalayın
```

### Production Environment
```bash
# Production konfigürasyonu
cp .env.example .env.production
# Production değerlerini ayarlayın

# Deploy
./deployment/deploy.sh deploy --env production
```

Detaylı deployment rehberi için: [README-DEPLOYMENT.md](README-DEPLOYMENT.md)

## 🔧 Konfigürasyon

### Environment Variables

#### Ana Konfigürasyon (.env)
```env
# Güvenlik
JWT_SECRET=your-super-secret-jwt-key
MONGO_ROOT_PASSWORD=secure-password
REDIS_PASSWORD=redis-password

# Sunucu ayarları
SERVER_IP_1=192.168.1.100
SERVER_IP_2=192.168.1.101
SERVER_IP_3=192.168.1.102

# Admin paneli
ADMIN_KEY_1=general-admin-key
ADMIN_KEY_2=gaming-admin-key
ADMIN_KEY_3=study-admin-key
```

#### Android Uygulaması
`app/src/main/java/com/serverchat/app/network/RetrofitClient.kt`:
```kotlin
private const val BASE_URL = "http://your-main-server.com/api/"
```

## 📱 Android App Özellikleri

### Ekranlar
1. **Ana Ekran**: Sunucu listesi ve kayıt
2. **Sunucu Kayıt**: Yeni sunucu oluşturma
3. **Sunucu Listesi**: Mevcut sunucuları görüntüleme
4. **Chat Ekranı**: Real-time mesajlaşma

### Özellikler
- **Real-time Messaging**: WebSocket ile anlık mesaj
- **User Management**: Online kullanıcı listesi
- **Server Discovery**: Otomatik sunucu keşfi
- **Security**: Cihaz bazlı kimlik doğrulama
- **Notifications**: Arkaplan bildirimleri
- **Offline Mode**: Yerel veri saklama

## 🛡️ Güvenlik Önlemleri

### API Güvenliği
- **Rate Limiting**: İstek hızı kontrolü
- **Input Validation**: Girdi doğrulama
- **Authentication**: JWT tabanlı kimlik doğrulama
- **CORS**: Cross-origin istek kontrolü

### Chat Güvenliği
- **Spam Protection**: Mesaj hızı kontrolü
- **Auto Ban**: Otomatik banlama sistemi
- **Content Filtering**: İçerik filtresi
- **Device Tracking**: Cihaz bazlı takip

## 📈 Performans

### Optimizasyonlar
- **Connection Pooling**: Veritabanı bağlantı havuzu
- **Caching**: Redis ile cache
- **Compression**: Gzip sıkıştırma
- **Load Balancing**: Nginx ile yük dağıtımı

### Ölçeklendirme
```bash
# Chat sunucularını ölçeklendir
./deployment/deploy.sh scale chat-server-general 3

# Database replica set
docker-compose -f docker-compose.full.yml --profile replica up -d
```

## 🐛 Troubleshooting

### Yaygın Sorunlar

#### Bağlantı Sorunları
```bash
# Servis durumunu kontrol et
./deployment/deploy.sh status

# Logları incele
./deployment/deploy.sh logs service-name

# Health check
curl -f http://localhost:3000/api/health
```

#### Android Uygulama Sorunları
1. **Gradle Sync**: Android Studio'da Sync Project
2. **API URL**: RetrofitClient.kt'de BASE_URL kontrol et
3. **Network**: Internet izni ve clear text traffic
4. **Dependencies**: build.gradle dependencies kontrol et

#### Database Sorunları
```bash
# MongoDB durumu
docker-compose exec mongodb mongosh --eval "db.runCommand('ping')"

# Redis durumu
docker-compose exec redis redis-cli ping
```

## 📚 Dokümantasyon

- **[Android App](app/README.md)**: Mobil uygulama detayları
- **[Main Server](main-server/README.md)**: Ana sunucu API
- **[Chat Server](chat-server/README.md)**: Chat sunucusu
- **[Database](database/README.md)**: Veritabanı konfigürasyonu
- **[Deployment](README-DEPLOYMENT.md)**: Production deployment

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

### Development Workflow
```bash
# Backend değişiklikleri
cd main-server/ # veya chat-server/
npm run dev

# Android değişiklikleri
# Android Studio'da Run/Debug

# Database değişiklikleri
cd database/
./database-setup.sh restart
```

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

## 🎯 Roadmap

### v1.1
- [ ] Voice chat desteği
- [ ] File sharing
- [ ] Emoji reactions
- [ ] User profiles

### v1.2
- [ ] Video chat
- [ ] Screen sharing
- [ ] Bot API
- [ ] Plugins system

### v2.0
- [ ] Web client
- [ ] Desktop apps
- [ ] Advanced moderation
- [ ] Analytics dashboard

## 📞 Destek

- **Issues**: GitHub Issues sayfasında sorun bildirebilirsiniz
- **Discussions**: GitHub Discussions'da soru sorabilirsiniz
- **Documentation**: Her klasörde detaylı README dosyaları bulunmaktadır

---

## 🎉 Başarıyla Kuruldu!

Tüm servisler çalışıyorsa:

1. **Ana Sunucu**: http://localhost:3000
2. **Chat Sunucuları**: http://localhost:8080, 8081, 8082
3. **Admin Panel**: http://localhost:8090 (Mongo Express)
4. **Monitoring**: http://localhost:3001 (Grafana)

Android uygulamanızı çalıştırın ve mesajlaşmaya başlayın! 🚀

**Not**: Production ortamında deployment yapmadan önce [README-DEPLOYMENT.md](README-DEPLOYMENT.md) dosyasını mutlaka okuyun.