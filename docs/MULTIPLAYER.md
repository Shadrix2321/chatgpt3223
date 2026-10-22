# İnternetten oda bağlantısı

Bu kopya, oda oluşturmak için PeerJS'in herkese açık eşleştirme sunucusuna bağlı değildir. `server.mjs` aynı sitede oda kaydını, WebRTC sinyalleşmesini ve WebSocket aktarım yolunu sağlar. Oyun kuralları ve Locust simülasyonu oda sahibinin tarayıcısında çalışır.

## Çalıştırma

```sh
cd /workspace/yazilimindirvip-playcanvas
npm ci --cache /workspace/.cache/npm
npm run build
npm start
```

Varsayılan dinleme adresi `127.0.0.1`, port `8001`'dir. Yerel kontroller `/health` ve `/runtime-config` uçlarından yapılabilir. Tek oyunculu oyun ağ bağlantısı açmaz. Sunucu olmadan statik dosyalarla tek oyunculu oynanabilir; çok oyunculu mod için bu Node sunucusu gerekir.

## Farklı ev, mobil ağ ve IP adresleri

Oyuncuların aynı Wi-Fi ağında olması gerekmez. İkisinin de **aynı herkese açık HTTPS site adresini** açması gerekir. Bu adres Node sunucusuna yönlenmeli ve `/room` için WebSocket upgrade bağlantısını geçirmelidir. Sadece Netlify'e statik klasör yüklemek bu yeni aktarım sunucusunu çalıştırmaz.

Sunucu bir VPS, container veya WebSocket destekleyen Node barındırma hizmetinde çalıştırılabilir:

```sh
HOST=0.0.0.0 PORT=8001 PUBLIC_ORIGIN=https://oyun.example npm start
```

`PUBLIC_ORIGIN`, gerçek sitenin şema ve alan adıdır; örnekteki adresin yerine kendi adresinizi yazın. HTTPS/TLS ve alan adı hizmetin reverse proxy katmanında ayarlanır. Proxy hem normal HTTP isteklerini hem de `/room` WebSocket bağlantısını aynı Node işlemine iletmelidir. Birden çok sunucu süreci kullanılıyorsa odalar bellekte tutulduğu için aynı odanın bağlantıları aynı sürece yönlenmelidir. Çok makineli oda paylaşımı bu sürümde yoktur.

Kurulum sırasında gerçek bir alan adına dağıtım yapılmadı. İki yerel istemci ve sekme ile bağlantı sınamaları, farklı evlerdeki NAT/ağ kombinasyonlarının üretim doğrulaması yerine geçmez.

## Bağlantı seçimi

1. WebSocket aktarım yolu, katılımın hemen ardından oyun verilerini taşıyabilir. Doğrudan bağlantı beklenerek oyun geciktirilmez.
2. Aynı anda yerel WebRTC veri kanalı kurulmaya çalışılır. ICE, mevcut STUN/TURN adaylarını kendi bağlantı kontrolleriyle değerlendirir.
3. Uygulama iki açık yol üzerinde gidiş-dönüş sürelerini ölçer. En az üç örnekten sonra daha hızlı yol seçilir; küçük dalgalanmalarda yol değiştirilmez.
4. WebRTC kesilirse açık WebSocket aktarım yoluna geçilir. Yanıtsız istekler aynı kimlikle aktarım yolundan tekrar gönderilir; oda sahibi bu kimlikleri saklayarak bir ürünün ya da komutun iki kere işlenmesini önler.
5. WebSocket kısa süreli koparsa 20 saniyelik oda oturumu yeniden bağlanma penceresi vardır. Aynı oyuncu kimliği korunur. Oda sahibinin sekmesi kapanırsa oda kapanır.

WebRTC doğrudan bağlantısı bazı ağlarda kurulamayabilir. Oyun sunucusunun HTTPS/WebSocket yolu erişilebildiği sürece aktarım yolu bu durumda kullanılabilir. WebSocket'i de engelleyen ağlar için bağlantı garantisi verilemez.

## İsteğe bağlı TURN

Varsayılan ICE sunucusu `stun:stun.l.google.com:19302`'dir. WebSocket aktarımı sayesinde TURN, temel çok oyunculu bağlantının zorunlu koşulu değildir. WebRTC'nin zor NAT koşullarında da aktarım kullanabilmesi istenirse sunucu ortamında `ICE_SERVERS_JSON` tanımlanabilir:

```json
[
  { "urls": "stun:stun.l.google.com:19302" },
  {
    "urls": ["turn:turn.example:3478", "turns:turn.example:443"],
    "username": "TURN_HIZMETININ_VERDIGI_KISA_OMURLU_KULLANICI",
    "credential": "TURN_HIZMETININ_VERDIGI_KISA_OMURLU_PAROLA"
  }
]
```

Bu örnek gerçek kimlik bilgisi içermez. Gerçek değerler barındırma hizmetinin güvenli ortam değişkeni ayarlarına girilmelidir. TURN kimliği istemci tarayıcısına iletilmek zorunda olduğundan üretimde kısa ömürlü, sınırlı yetkili TURN kimlikleri kullanın; kalıcı yönetim anahtarlarını buraya koymayın. Yapılandırma yanıtı önbelleğe alınmaz ve sunucu kimlik bilgilerini konsola yazmaz.

Gerekli ağ hedefleri: yayımlanan oyun alan adı için HTTPS/WSS; isteğe bağlı doğrudan WebRTC için Google STUN (UDP 19302) ve tanımlanan TURN hizmetleri. Kenney, Google Fonts, PeerJS Cloud veya bir CDN, yerel varlıkları yüklemek için gerekli değildir.

## Tanı ve doğrulama

`?transport=relay` sorgusu WebRTC'yi kapatarak aktarım yolunun bağımsız sınanmasını sağlar. `Mh.stats` seçilen yolu, ölçülen gecikmeyi ve doğrudan kanal durumunu sunar.

```sh
node --test tests/network.test.mjs
```

Testler gerçek WebSocket istemcileriyle oda oluşturma/katılma, sekiz kişilik eşzamanlı trafik, kapasite sınırı, oda sahibi yetkileri, sunucu tarafından bağlanan oyuncu kimliği, bağlantı yenileme, kopan oyuncunun temizlenmesi, yinelenen isteklerin tek işlenmesi, bozuk/büyük mesaj reddi ve statik dosya erişim sınırlarını denetler. WebRTC'nin gerçek tarayıcıdaki veri kanalı ayrıca iki sekmeyle sınanmalıdır.

Bu bulut ortamındaki Chromium'un yönetilen `/etc/chromium/policies/managed/misc.json` dosyasında `WebRtcIPHandling=disable_non_proxied_udp` ilkesi bulunur. Gerçek iki tarayıcı bağlamında teklif/yanıt sinyalleşmesi tamamlanır; bu ilke altında tarayıcı uygulamaya paylaşılabilir ICE adayı iletmez: `icecandidate` olayı ve SDP içindeki aday sayısı sıfırdır. Tarayıcının iç istatistiklerinde paylaşılmayan yerel aday kayıtları görülebilir. Dolayısıyla burada doğrudan WebRTC veri kanalının ve farklı evler arasındaki bağlantının çalıştığı iddia edilmez. Oda oluşturma, katılma, geceyi başlatma ve durum eşitleme WebSocket aktarımıyla doğrulanmıştır. Yönetilen ilke değiştirilmemiştir.

Bu gözlemi tekrarlamak için, Playwright ve sistem Chromium'u bulunan ortamda `python3 tools/rtc-smoke.py` çalıştırılır. Sonuç `artifacts/rtc-smoke.json` içine yazılır. Test gerçek aday olaylarını, SDP'yi ve iç istatistikleri ayrı sayar; doğrudan kanal açılmamasını ancak yukarıdaki yönetilen ilke mevcutsa ve sıfır paylaşılabilir aday gözlenmişse beklenen ortam kısıtı olarak kaydeder. Başka bir ortamda açıklanamayan bağlantı hatasını geçerli saymaz. İlkenin olmadığı ve doğrudan kanalın açıldığı ortamda gerçek veri kanalı isteği ve kanal kapatıldıktan sonraki aktarım yoluna dönüş de sınanır.

Sunucu kaynak dosyalarını, `node_modules`, `.git`, yedekleri veya ortam dosyalarını HTTP üzerinden sunmaz. Odalar geçicidir; beş haneli kodlar bir hesap giriş sistemi değildir. Oda sahibi tarayıcısının oyundaki yetkili istemci olması özgün oyunun çalışma modelini korur.
