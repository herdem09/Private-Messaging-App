# ServerChat Database Configuration

Bu dizin, ServerChat uygulamasının veritabanı konfigürasyonlarını ve yönetim araçlarını içerir.

## İçerik

- **MongoDB**: Ana veritabanı (sunucu kayıtları, istatistikler)
- **Redis**: Cache ve session yönetimi
- **Backup/Restore**: Otomatik yedekleme sistemi
- **Monitoring**: Veritabanı izleme araçları

## Hızlı Başlangıç

### 1. Veritabanlarını Kurma

```bash
# Tüm veritabanlarını kur ve başlat
./database-setup.sh setup

# Sadece temel servisleri başlat
./database-setup.sh start

# Admin araçlarıyla birlikte başlat
./database-setup.sh start --profile admin-tools
```

### 2. Durum Kontrolü

```bash
# Servis durumunu kontrol et
./database-setup.sh status

# Logları görüntüle
./database-setup.sh logs
./database-setup.sh logs mongodb-primary
```

### 3. Veritabanı Erişimi

```bash
# MongoDB shell
./database-setup.sh shell

# Redis CLI
./database-setup.sh redis-cli
```

## Dosya Yapısı

```
database/
├── init-mongo.js           # MongoDB başlatma scripti
├── mongodb.conf            # MongoDB konfigürasyonu
├── redis.conf              # Redis konfigürasyonu
├── docker-compose.db.yml   # Docker Compose konfigürasyonu
├── database-setup.sh       # Veritabanı yönetim aracı
├── backup-restore.sh       # Yedekleme/geri yükleme aracı
├── backups/                # Yedek dosyaları
├── monitoring/             # İzleme logları
└── README.md               # Bu dosya
```

## MongoDB Konfigürasyonu

### Koleksiyonlar

1. **servers**: Chat sunucuları kayıtları
   - Sunucu bilgileri (IP, port, isim, açıklama)
   - Kullanıcı istatistikleri
   - Ban listesi
   - Sahip bilgileri

2. **server_stats**: Sunucu istatistikleri
   - Zaman serisi verileri
   - Kullanıcı sayıları
   - Mesaj istatistikleri
   - Sistem kaynakları

3. **system_logs**: Sistem logları
   - Hata logları
   - Güvenlik olayları
   - Performans metrikleri

### Indexler

Performans için optimize edilmiş indexler:
- IP adresi + port (unique)
- Online durumu
- Oluşturma tarihi
- Son ping zamanı
- Text search (isim, açıklama, etiketler)

### Validation

MongoDB schema validation ile veri bütünlüğü:
- IP adresi format kontrolü
- Port aralığı (1-65535)
- String uzunluk limitleri
- Required field kontrolü

## Redis Konfigürasyonu

### Kullanım Alanları

- Session yönetimi
- Cache (sık kullanılan veriler)
- Rate limiting
- Real-time pub/sub

### Güvenlik

- Password koruması
- Tehlikeli komutların devre dışı bırakılması
- Memory limitleri
- Connection limitleri

## Yedekleme ve Geri Yükleme

### Otomatik Yedekleme

```bash
# Günlük yedekleme (sıkıştırılmış)
./backup-restore.sh backup --compress

# Yedekleri listele
./backup-restore.sh list

# Eski yedekleri temizle (30 gün)
./backup-restore.sh clean
```

### Manuel Yedekleme

```bash
# Basit yedek
./backup-restore.sh backup

# Sıkıştırılmış yedek
./backup-restore.sh backup --compress

# Belirli sunucudan yedek
./backup-restore.sh backup --host remote-server --port 27017
```

### Geri Yükleme

```bash
# Yedekten geri yükle
./backup-restore.sh restore backups/serverchat-main_20231201_120000.archive.gz

# Farklı veritabanına geri yükle
./backup-restore.sh restore backup.archive --db serverchat-test
```

## İzleme ve Yönetim

### Web Arayüzleri

1. **Mongo Express**: MongoDB yönetimi
   - URL: http://localhost:8081
   - Kullanıcı: admin / admin123

2. **Redis Commander**: Redis yönetimi
   - URL: http://localhost:8082
   - Kullanıcı: admin / admin123

### Komut Satırı İzleme

```bash
# Veritabanı durumu
./database-setup.sh status

# Real-time loglar
./database-setup.sh logs -f

# MongoDB shell
./database-setup.sh shell

# Redis CLI
./database-setup.sh redis-cli
```

### Performans İzleme

```bash
# MongoDB stats
docker-compose -f docker-compose.db.yml --profile monitoring up -d mongo-stats

# İzleme loglarını görüntüle
tail -f monitoring/mongo-stats.log
```

## Docker Compose Profilleri

### Temel Servisler
```bash
docker-compose -f docker-compose.db.yml up -d
```

### Admin Araçları
```bash
docker-compose -f docker-compose.db.yml --profile admin-tools up -d
```

### Replica Set
```bash
docker-compose -f docker-compose.db.yml --profile replica up -d
```

### Yedekleme Servisi
```bash
docker-compose -f docker-compose.db.yml --profile backup up -d
```

### İzleme Araçları
```bash
docker-compose -f docker-compose.db.yml --profile monitoring up -d
```

## Environment Variables

`.env` dosyasında konfigüre edilebilir değişkenler:

```env
# MongoDB
MONGO_ROOT_PASSWORD=secure_admin_password_123
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASS=admin123

# Redis
REDIS_PASSWORD=redis_password_123
REDIS_COMMANDER_USER=admin
REDIS_COMMANDER_PASS=admin123

# Backup
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE=0 2 * * *

# Monitoring
ENABLE_MONITORING=true
STATS_INTERVAL=300
```

## Güvenlik Önerileri

### Üretim Ortamı

1. **Güçlü Şifreler**: Tüm şifreleri değiştirin
2. **Network Güvenliği**: Sadece gerekli portları açın
3. **SSL/TLS**: Üretimde şifreleme kullanın
4. **Firewall**: Veritabanı erişimini sınırlayın
5. **Backup Şifreleme**: Yedekleri şifreleyin

### Konfigürasyon

```bash
# SSL sertifikaları
mkdir -p ssl/
# Sertifikaları ssl/ dizinine kopyalayın

# Firewall kuralları
ufw allow from 10.0.0.0/8 to any port 27017
ufw allow from 10.0.0.0/8 to any port 6379
```

## Troubleshooting

### Yaygın Sorunlar

1. **Bağlantı Hatası**
   ```bash
   # Servisleri yeniden başlat
   ./database-setup.sh restart
   
   # Port kontrolü
   netstat -tlnp | grep -E "(27017|6379)"
   ```

2. **Disk Alanı**
   ```bash
   # Disk kullanımı
   df -h
   
   # Eski logları temizle
   docker system prune -a
   ```

3. **Memory Issues**
   ```bash
   # Memory kullanımı
   docker stats
   
   # Redis memory info
   ./database-setup.sh redis-cli info memory
   ```

### Log Analizi

```bash
# MongoDB logları
docker-compose -f docker-compose.db.yml logs mongodb-primary | grep ERROR

# Redis logları
docker-compose -f docker-compose.db.yml logs redis | grep WARNING

# Sistem logları
journalctl -u docker
```

### Performance Tuning

1. **MongoDB**
   - WiredTiger cache boyutu
   - Index optimizasyonu
   - Connection pool ayarları

2. **Redis**
   - Memory policy (allkeys-lru)
   - Persistence ayarları
   - Connection limits

## Backup Stratejisi

### Üretim Önerileri

1. **Günlük Yedekler**: Tam yedekleme
2. **Haftalık Yedekler**: Uzun dönem saklama
3. **Aylık Yedekler**: Arşiv
4. **Disaster Recovery**: Uzak lokasyon

### Otomasyonu

```bash
# Crontab entry
0 2 * * * /path/to/backup-restore.sh backup --compress --quiet

# Systemd timer
systemctl enable serverchat-backup.timer
```

## Ölçeklendirme

### Replica Set Kurulumu

```bash
# Replica set başlat
docker-compose -f docker-compose.db.yml --profile replica up -d

# Replica set konfigüre et
./database-setup.sh shell
rs.initiate({
  _id: "serverchat-rs",
  members: [
    { _id: 0, host: "mongodb-primary:27017" },
    { _id: 1, host: "mongodb-secondary:27017" }
  ]
})
```

### Sharding (Büyük Ölçek)

```bash
# Config server
# Shard servers
# Mongos router
# Detaylar için MongoDB sharding dokümantasyonuna bakın
```

## Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun
3. Testleri çalıştırın
4. Pull request gönderin

## Lisans

MIT