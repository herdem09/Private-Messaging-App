# WhatsApp Clone Android Uygulaması

Bu proje, WhatsApp benzeri bir Android sohbet uygulamasıdır. Kotlin dilinde yazılmış ve WebSocket teknolojisi kullanılarak gerçek zamanlı mesajlaşma özelliği sunmaktadır.

## Özellikler

- ✅ Kullanıcı adı ile giriş
- ✅ Gerçek zamanlı mesajlaşma (WebSocket)
- ✅ WhatsApp benzeri modern UI tasarım
- ✅ Arka plan servisi
- ✅ Push bildirimler
- ✅ Mesaj gönderme/alma
- ✅ Bağlantı durumu göstergesi

## Teknik Detaylar

### Kullanılan Teknolojiler
- **Kotlin** - Ana programlama dili
- **WebSocket** - Gerçek zamanlı iletişim
- **Material Design** - Modern UI tasarım
- **RecyclerView** - Mesaj listesi
- **Notification API** - Push bildirimler
- **SharedPreferences** - Veri saklama
- **Background Service** - Arka plan çalışma

### Proje Yapısı
```
WhatsAppClone/
├── app/
│   ├── src/main/
│   │   ├── java/com/whatsappclone/
│   │   │   ├── activities/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   └── ChatActivity.kt
│   │   │   ├── adapters/
│   │   │   │   └── MessageAdapter.kt
│   │   │   ├── models/
│   │   │   │   └── Message.kt
│   │   │   ├── services/
│   │   │   │   └── WebSocketService.kt
│   │   │   └── utils/
│   │   │       └── NotificationHelper.kt
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   ├── values/
│   │   │   ├── drawable/
│   │   │   └── mipmap-*/
│   │   └── AndroidManifest.xml
│   ├── build.gradle
│   └── proguard-rules.pro
├── gradle/
├── build.gradle
├── settings.gradle
└── gradle.properties
```

## Kurulum

1. **Android Studio'yu açın**
2. **"Open an existing project"** seçeneğini tıklayın
3. **WhatsAppClone** klasörünü seçin
4. **Gradle sync** işleminin tamamlanmasını bekleyin
5. **Run** butonuna tıklayarak uygulamayı çalıştırın

## Kullanım

1. **İlk Açılış**: Uygulama açıldığında isim girmeniz istenir
2. **İsim Girişi**: 2-20 karakter arası bir isim girin
3. **Chat Ekranı**: Otomatik olarak chat ekranına yönlendirilirsiniz
4. **Mesaj Gönderme**: Alt kısımdaki metin kutusuna mesaj yazıp gönderin
5. **Mesaj Formatı**: Gönderilen mesajlar "isim-mesaj" formatında servera iletilir

## WebSocket Server

Şu anda test amaçlı olarak `ws://echo.websocket.org` kullanılmaktadır. 
Gerçek projede kendi WebSocket serverınızı kullanmalısınız.

**WebSocketService.kt** dosyasında `WEBSOCKET_URL` değişkenini kendi server adresinizle değiştirin:

```kotlin
private const val WEBSOCKET_URL = "ws://your-server.com:8080/chat"
```

## Mesaj Formatı

- **Gönderilen mesaj**: `"kullanici_adi-mesaj_metni"`
- **Örnek**: `"hidayet-Merhaba nasılsın?"`

## Bildirimler

- Uygulama arka plandayken gelen mesajlar için bildirim gösterilir
- Bildirime tıklandığında uygulama açılır
- Uygulama ön plandayken bildirim gösterilmez

## Gereksinimler

- **Android SDK**: Minimum 24 (Android 7.0)
- **Target SDK**: 34 (Android 14)
- **Kotlin**: 1.9.10
- **Gradle**: 8.2.0

## İzinler

Uygulama aşağıdaki izinleri kullanır:
- `INTERNET` - WebSocket bağlantısı için
- `WAKE_LOCK` - Arka plan servisi için
- `FOREGROUND_SERVICE` - Sürekli çalışan servis için
- `POST_NOTIFICATIONS` - Push bildirimler için

## Geliştirme Notları

- Uygulama arka planda sürekli çalışır (WhatsApp gibi)
- WebSocket bağlantısı koptuğunda otomatik yeniden bağlanır
- Mesajlar RecyclerView ile gösterilir
- Gönderilen ve alınan mesajlar farklı tasarımda gösterilir
- Material Design 3 kullanılmıştır

## Lisans

Bu proje eğitim amaçlı oluşturulmuştur.