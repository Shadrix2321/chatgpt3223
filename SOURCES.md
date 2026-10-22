# Varlıklar

Bu çalışma kopyasının görüntüleme motoru PlayCanvas Engine 2.23.3 — MIT'dir.
Three.js aşağıda özgün sürümün tarihsel bağımlılığı olarak listelenir;
yeni HTML ve tarayıcı paketi Three.js çalıştırmaz. PeerJS tabanlı özgün
bağlantının yerini yerel WebRTC ve WebSocket aktarım kodu almıştır.
Varlıkların kaynak ve lisans beyanları korunur.

## Kenney — CC0

- [Mini Market](https://kenney.nl/assets/mini-market): kasalar, dondurucular, ürün teşhirleri ve dekoratif arabalar. Resmi ZIP'ten indirildi.
- [Food Kit](https://kenney.nl/assets/food-kit): 12 ayrı yiyecek/ambalaj modeli. Resmi ZIP'ten indirildi.
- Lisans metinleri `public/assets/mini-market/LICENSE.txt` ve `public/assets/food-kit/LICENSE.txt` içinde.
- Bu proje modelleri ölçekler, çoğaltır ve geometriyi istemcide birleştirir. Harita düzeni özgündür; Aisles of the Locust haritası kopyalanmamıştır.

## Locust

Kullanıcının sağladığı `gmod_the_locust_pill_pack.glb` dosyası kullanıldı. Dosyanın kendi metadata beyanı:

- Başlık: GMod The Locust Pill Pack
- Yükleyen: The reuploader / GentleFinder4563
- [Kaynak](https://sketchfab.com/3d-models/gmod-the-locust-pill-pack-2158cfe34f484aff9d920604be01c624)
- Lisans beyanı: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Model oyunda 4,4 metre yüksekliğe ölçeklendi; materyaller/animasyon dosyası korunmuştur. Idle, Walk ve Run oyunda kullanılır; diğer klipler dosyada durur.

Kaynak sayfasındaki hak sahipliği ve lisans yetkisi bağımsız doğrulanamadı. Steam paketinin listelenen emek sahipleri: Nick/Noodles (kod), Dark Star ve RED MECHA (animasyon), Waqinto (model). Referans: https://steamcommunity.com/sharedfiles/filedetails/?id=3554915969 .

## Sesler

Kullanıcı aşağıdaki kayıtları kullanmayı seçti. Bunlar Aisles of the Locust'ün resmi dosya dağıtımı olarak doğrulanmadı; topluluk yüklemeleridir. Bağımsız yeniden kullanım lisansı belirtilmemiştir. Modelin CC BY beyanı sesleri kapsamaz.

| Dosya | Kaynak |
|---|---|
| alert.mp3 | https://tuna.voicemod.net/sound/7e28bd67-95c5-4320-ac3b-201b174d7993 |
| jumpscare.mp3 | https://tuna.voicemod.net/sound/e8702738-a636-454b-ae1b-5a409a6e0edc |
| footstep1.mp3 | https://tuna.voicemod.net/sound/146921bf-e50f-4d61-be28-e54185586916 |
| footstep2.mp3 | https://tuna.voicemod.net/sound/950c90db-8eb7-41dc-aec8-d17f2a13449c |
| footstep3.mp3 | https://tuna.voicemod.net/sound/3f0bbf94-c6b5-46fa-a23a-d0022a439c72 |
| footstep4.mp3 | https://tuna.voicemod.net/sound/dc194651-17f0-401c-88ad-06fda8275b39 |

Özgün indirme bağlantıları, gerçek dosya süreleri ve codec bilgisi `public/assets/audio/sources.json` içinde. Oyunun düşük floresan uğultusu ve ürün alma sinyali kodla üretilir.

## Kod ve yazı tipleri

- [Three.js](https://threejs.org/) 0.180.0 — MIT; lisansı projeye dahil.
- [PeerJS](https://github.com/peers/peerjs) 1.5.5 — MIT; lisansı `assets/LICENSE-peerjs.txt` içinde. Hazır PeerServer Cloud eşleşme hizmeti kullanılır.
- Barlow Condensed ve Manrope — Google Fonts resmi dağıtımı, SIL Open Font License. Metinleri `public/assets/fonts/*-OFL.txt` içinde.

Metal raf modülleri ve oyuncuların tel sepetli arabaları bu proje için geometriyle oluşturuldu. Locust modeline ileri yön düzeltmesi (+90 derece Y dönüşü) uygulanır; yürüyüş kliplerinin hızı kat edilen mesafeye göre ayarlanır.
