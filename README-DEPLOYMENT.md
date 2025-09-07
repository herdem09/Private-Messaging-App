# 🚀 ServerChat Deployment Guide

Bu rehber, ServerChat uygulamasının production ortamında nasıl deploy edileceğini açıklar.

## 📋 İçindekiler

- [Sistem Gereksinimleri](#sistem-gereksinimleri)
- [Hızlı Başlangıç](#hızlı-başlangıç)
- [Production Deployment](#production-deployment)
- [Monitoring ve İzleme](#monitoring-ve-i̇zleme)
- [Backup ve Restore](#backup-ve-restore)
- [Troubleshooting](#troubleshooting)
- [Ölçeklendirme](#ölçeklendirme)

## 🖥️ Sistem Gereksinimleri

### Minimum Gereksinimler
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 20GB SSD
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Docker destekli sistem
- **Network**: İnternet bağlantısı

### Önerilen Gereksinimler
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Disk**: 100GB+ SSD
- **OS**: Ubuntu 22.04 LTS
- **Network**: Yüksek bant genişliği

### Gerekli Yazılımlar
```bash
# Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Git
sudo apt update && sudo apt install -y git

# jq (JSON processor)
sudo apt install -y jq

# nginx (if not using Docker)
sudo apt install -y nginx
```

## 🚀 Hızlı Başlangıç

### 1. Projeyi İndirin
```bash
git clone <repository-url>
cd ServerChat
```

### 2. Environment Konfigürasyonu
```bash
# Environment dosyasını oluşturun
cp .env.example .env

# Güvenlik ayarlarını değiştirin
nano .env
```

**Önemli**: Aşağıdaki değerleri mutlaka değiştirin:
- `MONGO_ROOT_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `ADMIN_KEY_*`
- Tüm admin panel şifreleri

### 3. Temel Deployment
```bash
# Deployment scriptini çalıştırın
./deployment/deploy.sh deploy

# Veya manuel olarak
docker-compose -f docker-compose.full.yml up -d
```

### 4. Durumu Kontrol Edin
```bash
./deployment/deploy.sh status
```

## 🏭 Production Deployment

### 1. SSL/TLS Sertifikaları

```bash
# SSL sertifikaları için dizin oluşturun
mkdir -p nginx/ssl

# Let's Encrypt ile sertifika alın
sudo certbot certonly --standalone -d yourdomain.com

# Sertifikaları kopyalayın
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem

# DH parameters oluşturun
openssl dhparam -out nginx/ssl/dhparam.pem 2048
```

### 2. Nginx Konfigürasyonu

`nginx/nginx.conf` dosyasında HTTPS'i aktifleştirin:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_dhparam /etc/nginx/ssl/dhparam.pem;
    
    # ... diğer konfigürasyonlar
}
```

### 3. Production Environment

`.env.production` dosyası oluşturun:

```env
NODE_ENV=production
DEPLOYMENT_ENV=production

# Güvenlik
JWT_SECRET=your-super-secure-jwt-secret-here
BCRYPT_ROUNDS=12

# Database
MONGO_ROOT_PASSWORD=very-secure-mongo-password
REDIS_PASSWORD=very-secure-redis-password

# CORS (production domain'iniz)
ALLOWED_ORIGINS=https://yourdomain.com,https://chat.yourdomain.com

# Monitoring
ENABLE_MONITORING=true
```

### 4. Production Deployment

```bash
# Production environment ile deploy edin
./deployment/deploy.sh deploy --env production

# Tüm profilleri aktifleştirin
COMPOSE_PROFILES=admin,monitoring,backup ./deployment/deploy.sh deploy --env production
```

## 📊 Monitoring ve İzleme

### Grafana Dashboard

1. **Erişim**: http://yourdomain.com/grafana/
2. **Login**: admin / (GRAFANA_PASSWORD)

### Prometheus Metrics

1. **Erişim**: http://yourdomain.com/prometheus/
2. **Metrics**: Sistem ve uygulama metrikleri

### Log Aggregation

```bash
# Logları görüntüle
./deployment/deploy.sh logs

# Belirli servis logları
./deployment/deploy.sh logs main-server

# Real-time log takibi
docker-compose -f docker-compose.full.yml logs -f
```

### Health Checks

```bash
# Tüm servislerin durumunu kontrol et
./deployment/deploy.sh health

# Manuel health check
curl -s http://localhost:3000/api/health/detailed | jq
```

## 💾 Backup ve Restore

### Otomatik Backup

```bash
# Backup servisini başlat
docker-compose -f docker-compose.full.yml --profile backup up -d

# Manuel backup
docker-compose -f docker-compose.full.yml exec backup-service /scripts/backup.sh backup
```

### S3 Backup Konfigürasyonu

`.env` dosyasına ekleyin:

```env
S3_BACKUP_BUCKET=your-backup-bucket
S3_ACCESS_KEY=your-aws-access-key
S3_SECRET_KEY=your-aws-secret-key
```

### Restore İşlemi

```bash
# Mevcut backup'ları listele
docker-compose -f docker-compose.full.yml exec backup-service /scripts/backup.sh list

# Backup'tan restore et
docker-compose -f docker-compose.full.yml exec backup-service /scripts/backup.sh restore /backups/backup-file.archive.gz
```

## 🔧 Troubleshooting

### Yaygın Sorunlar

#### 1. Servis Başlamıyor

```bash
# Container loglarını kontrol et
docker-compose -f docker-compose.full.yml logs service-name

# Container durumunu kontrol et
docker-compose -f docker-compose.full.yml ps

# Health check
docker-compose -f docker-compose.full.yml exec service-name curl -f http://localhost:port/api/health
```

#### 2. Database Bağlantı Sorunu

```bash
# MongoDB durumu
docker-compose -f docker-compose.full.yml exec mongodb mongosh --eval "db.runCommand('ping')"

# Redis durumu
docker-compose -f docker-compose.full.yml exec redis redis-cli ping
```

#### 3. Memory/CPU Sorunları

```bash
# Resource kullanımı
docker stats

# System resources
free -h
df -h
top
```

#### 4. Network Sorunları

```bash
# Port kontrolü
netstat -tlnp | grep -E "(3000|8080|8081|8082)"

# Container network
docker network ls
docker network inspect serverchat-network
```

### Log Analizi

```bash
# Error logları
docker-compose -f docker-compose.full.yml logs | grep ERROR

# Performans logları
docker-compose -f docker-compose.full.yml logs | grep "slow\|timeout\|high"

# Security logları
docker-compose -f docker-compose.full.yml logs | grep "ban\|attack\|suspicious"
```

## 📈 Ölçeklendirme

### Horizontal Scaling

```bash
# Chat sunucularını ölçeklendir
./deployment/deploy.sh scale chat-server-general 3

# Load balancer ayarları nginx.conf'da
upstream chat_servers {
    server chat-server-general_1:8080;
    server chat-server-general_2:8080;
    server chat-server-general_3:8080;
}
```

### Database Scaling

#### MongoDB Replica Set

```bash
# Replica set konfigürasyonu
docker-compose -f docker-compose.full.yml --profile replica up -d

# Replica set initialize
docker-compose -f docker-compose.full.yml exec mongodb-primary mongosh --eval "
rs.initiate({
  _id: 'serverchat-rs',
  members: [
    { _id: 0, host: 'mongodb-primary:27017' },
    { _id: 1, host: 'mongodb-secondary:27017' }
  ]
})
"
```

#### Redis Clustering

```yaml
# docker-compose.full.yml'ye ekle
redis-cluster:
  image: redis:7-alpine
  command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf
  ports:
    - "7000-7005:7000-7005"
```

### Load Balancing

#### Nginx Configuration

```nginx
upstream main_servers {
    least_conn;
    server main-server-1:3000 max_fails=3 fail_timeout=30s;
    server main-server-2:3000 max_fails=3 fail_timeout=30s;
    server main-server-3:3000 max_fails=3 fail_timeout=30s;
}

upstream chat_servers {
    ip_hash;  # Sticky sessions for WebSocket
    server chat-server-1:8080 max_fails=3 fail_timeout=30s;
    server chat-server-2:8080 max_fails=3 fail_timeout=30s;
    server chat-server-3:8080 max_fails=3 fail_timeout=30s;
}
```

## 🔒 Güvenlik

### Firewall Konfigürasyonu

```bash
# UFW ile temel güvenlik
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Sadece local network'ten database erişimi
sudo ufw allow from 10.0.0.0/8 to any port 27017
sudo ufw allow from 10.0.0.0/8 to any port 6379
```

### SSL/TLS Hardening

```nginx
# Nginx SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# Security headers
add_header Strict-Transport-Security "max-age=63072000" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
```

### Database Security

```bash
# MongoDB security
docker-compose -f docker-compose.full.yml exec mongodb mongosh --eval "
db.createUser({
  user: 'backup',
  pwd: 'backup-password',
  roles: [{ role: 'backup', db: 'admin' }]
})
"

# Redis security
# redis.conf'da:
# rename-command FLUSHDB ""
# rename-command FLUSHALL ""
```

## 🚨 Disaster Recovery

### Backup Strategy

1. **Günlük**: Full database backup
2. **Haftalık**: Application code backup
3. **Aylık**: Long-term archive

### Recovery Plan

```bash
# 1. Stop services
./deployment/deploy.sh stop

# 2. Restore database
./backup/scripts/backup.sh restore latest-backup.archive.gz

# 3. Restore application
git checkout <commit-hash>

# 4. Start services
./deployment/deploy.sh start

# 5. Verify health
./deployment/deploy.sh health
```

## 📞 Support

### Monitoring Alerts

```bash
# Disk space alert
df -h | awk '$5 > 80 {print "Disk space warning: " $0}'

# Memory alert
free | awk 'NR==2{printf "Memory usage: %.2f%%\n", $3/$2*100}'

# Service health
curl -f http://localhost:3000/api/health || echo "Main server down!"
```

### Contact Information

- **Documentation**: README.md files in each directory
- **Issues**: GitHub Issues
- **Emergency**: Check monitoring dashboards first

---

## 🎯 Production Checklist

- [ ] SSL certificates configured
- [ ] Environment variables secured
- [ ] Database passwords changed
- [ ] Admin panel passwords changed
- [ ] Firewall configured
- [ ] Backup system tested
- [ ] Monitoring dashboards accessible
- [ ] Log aggregation working
- [ ] Health checks passing
- [ ] Performance baseline established
- [ ] Disaster recovery plan tested
- [ ] Documentation updated
- [ ] Team access configured

Deployment başarılı! 🎉