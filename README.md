# ServerChat - Discord Benzeri Mesajlaşma Uygulaması

ServerChat, kullanıcıların kendi sunucularını oluşturabileceği ve yönetebileceği Discord benzeri bir mesajlaşma uygulamasıdır.

## Özellikler

### 🖥️ Sunucu Yönetimi
- **Sunucu Oluşturma**: Kullanıcılar kendi sunucularını kaydettirebilir
- **Ana Sunucu Kontrolü**: Tüm sunucular ana sunucu üzerinden yönetilir
- **IP Tabanlı Bağlantı**: Sunucular IP adresi ve port ile erişilebilir

### 🔒 Güvenlik Sistemi
- **Şifre Koruması**: Sunucular opsiyonel şifre ile korunabilir
- **Ban Sistemi**: Çok fazla yanlış deneme yapan cihazlar otomatik banlanır
- **Spam Koruması**: Aşırı mesaj gönderen kullanıcılar geçici olarak banlanır
- **Cihaz Takibi**: Her cihaz benzersiz ID ile takip edilir

### 💬 Mesajlaşma
- **Real-time Chat**: WebSocket ile anlık mesajlaşma
- **Kullanıcı Listesi**: Çevrimiçi kullanıcıları görme
- **Sistem Mesajları**: Kullanıcı giriş/çıkış bildirimleri
- **Mesaj Geçmişi**: Önceki mesajları görme

### 📱 Bildirimler
- **Arkaplan Servisi**: Uygulama kapalıyken bile bildirim alma
- **Push Notifications**: Yeni mesaj bildirimleri
- **Sunucu Durumu**: Bağlantı durumu takibi

## Kurulum

### Gereksinimler
- Android Studio Arctic Fox veya üzeri
- Android SDK 24 (Android 7.0) veya üzeri
- Java 8 veya üzeri

### Adımlar

1. **Projeyi İndirin**
   ```bash
   git clone <repository-url>
   cd ServerChat
   ```

2. **Android Studio'da Açın**
   - Android Studio'yu açın
   - "Open an existing project" seçin
   - İndirdiğiniz proje klasörünü seçin

3. **Gradle Sync**
   - Android Studio otomatik olarak Gradle sync yapacak
   - Eğer yapmıyorsa: `File > Sync Project with Gradle Files`

4. **Ana Sunucu URL'sini Ayarlayın**
   - `app/src/main/java/com/serverchat/app/network/RetrofitClient.kt` dosyasını açın
   - `BASE_URL` değişkenini kendi ana sunucunuzun URL'si ile değiştirin

5. **Uygulamayı Çalıştırın**
   - Bir Android cihaz bağlayın veya emulator başlatın
   - `Run` butonuna tıklayın

## Kullanım

### Sunucu Kaydetme
1. Ana ekranda "Sunucu Kaydet" butonuna tıklayın
2. Sunucu bilgilerini girin:
   - Sunucu adı
   - IP adresi
   - Port (varsayılan: 8080)
   - Şifre (opsiyonel)
3. "Kaydet" butonuna tıklayın

### Sunucuya Bağlanma
1. "Sunucuya Katıl" butonuna tıklayın
2. Listeden bir sunucu seçin
3. Kullanıcı adınızı girin
4. Gerekirse şifreyi girin
5. "Bağlan" butonuna tıklayın

### Mesajlaşma
1. Sunucuya başarıyla bağlandıktan sonra chat ekranı açılır
2. Alt kısımdaki metin kutusuna mesajınızı yazın
3. "Gönder" butonuna tıklayın veya Enter'a basın
4. Sağ üstteki kullanıcı ikonuna tıklayarak çevrimiçi kullanıcıları görün

## Teknik Detaylar

### Mimari
- **MVVM Pattern**: ViewModel ile UI logic ayrımı
- **Repository Pattern**: Veri katmanı soyutlaması
- **Jetpack Compose**: Modern UI framework
- **Coroutines**: Asenkron işlemler için
- **WebSocket**: Real-time komunikasyon

### Kullanılan Teknolojiler
- **Kotlin**: Ana programlama dili
- **Jetpack Compose**: UI framework
- **Retrofit**: HTTP client
- **WebSocket**: Real-time messaging
- **SharedPreferences**: Yerel veri saklama
- **Material Design 3**: UI tasarım sistemi

### API Endpoints

#### Ana Sunucu API'ları
- `POST /servers/register` - Sunucu kaydetme
- `GET /servers` - Kullanılabilir sunucuları listeleme
- `POST /servers/{id}/connect` - Sunucuya bağlanma

#### Sunucu API'ları
- `GET /servers/{id}/info` - Sunucu bilgilerini alma
- `GET /servers/{id}/messages` - Mesaj geçmişi
- `POST /servers/{id}/ban` - Kullanıcı banlama
- `WebSocket /ws` - Real-time mesajlaşma

## Güvenlik Önlemleri

### Ban Sistemi
- 5 yanlış şifre denemesinde 30 dakika ban
- Dakikada 10'dan fazla mesajda 60 dakika ban
- Cihaz bazlı takip ile ban kaçırma engellenir

### Veri Güvenliği
- Tüm kullanıcı girdileri sanitize edilir
- IP adresi ve port validasyonu
- Rate limiting ile spam önlenir
- Cihaz ID'leri hash'lenerek saklanır

## Sorun Giderme

### Bağlantı Sorunları
- İnternet bağlantınızı kontrol edin
- Sunucu IP ve port bilgilerinin doğru olduğundan emin olun
- Firewall ayarlarını kontrol edin

### Bildirim Sorunları
- Uygulama izinlerini kontrol edin
- Batarya optimizasyonundan çıkarın
- Bildirim kanalı ayarlarını kontrol edin

### Performans Sorunları
- Uygulamayı yeniden başlatın
- Cihazın boş hafızasını kontrol edin
- Ağ bağlantı kalitesini kontrol edin

## Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına bakın.

## İletişim

Sorularınız için lütfen issue açın veya iletişime geçin.

---

**Not**: Bu uygulama demo amaçlıdır. Üretim ortamında kullanmadan önce ek güvenlik önlemleri alınması önerilir.