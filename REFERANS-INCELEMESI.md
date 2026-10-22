# Referans ve değişikliklerin dayanağı

22 Ekim 2026. Kullanıcının gönderdiği [Aisles Of The Locust oynanışı](https://www.youtube.com/watch?v=CTszEzIBgyU) tarayıcıda doğrudan açıldı ve seçili bölümleri görüntülendi. Kayıt 30:36 uzunluğunda. Önceki otomatik analiz kaydı yaklaşık 5 dakikalık bir olay dizisi üretmişti; bu sonuç videonun gerçek zaman çizelgesi olarak kullanılmamalı. Videonun tamamı kesintisiz izlenmiş değildir.

Doğrudan gözlemlenen örnekler:

- Yaklaşık **02:00:** Geniş market, gri karo zemin, çok sayıda beyaz floresan, raflarda renkli ürünler, oyuncunun önünde sepet ve kollar. Normal ışık durumu önceki oyun sürümümüzden daha açık.
- **09:10:** Daha dar ve uzun raf geçidi, yüksekliği boyunca dolu raflar ve sepette biriken ürünler; alışveriş ilerlemesi üstte.
- **15:18:** Alçak teşhir bölümleri ve farklı reyon düzenleri.
- **24:29:** Camlı soğutucu reyonları ve floresan yansımaları.

Locust'un zayıf görüşü, koşu sesine ağırlık vermesi, raf devrilmesinin seyrekliği, kişisel listeler, 10 saniyelik teslimat ve kişi sayısıyla artan kota bu sürümde kullanıcının açık tarifine göre uygulanmıştır. Bu parametreler özgün oyunun kaynak kodundan çıkarılmış kesin sayılar olarak sunulmaz.

1.4 sürümünde:

- Koşu sesi 46 metreye kadar iz bırakır; normal yürümenin işitilme mesafesi 2,2 metreye iner. Yakın ve öne dönük görüş aralığı ayakta 7,5/eğilmede 4 metredir.
- Oyuncu yürüyüş/koşu hızları 5/8 m/s, Locust kovalamacası 6,65–7,3 m/s. Gerçek zaman adımlarıyla yapılan takip testinde yürüyen yakalanır, kesintisiz koşan uzaklaşır.
- Raflar olağan devriyede yıkılmaz. Yolu tıkanmış kovalamaca ve bekleme koşulları gerekir; gece başına en fazla bir raf.
- Oyuncuya ait listeler ve sepetler ayrıdır. İlk gece ekip kotası 6/10/14/18…; sonraki gecelerde +3. Bütün yaşayan ekip teslimat noktasında 10 saniye kesintisiz bekler.
- Modelin gerçek Jumpscare klibi, kol eklemi hedeflemesi, oyuncuyu tutma ve yana fırlatma eğrisiyle birleştirilir. Bu sahne özgün Roblox animasyonunun birebir aktarımı değildir. Can ve yeniden doğma sahne bittikten sonra güncellenir.
- Ağ durumları arasında zaman çizgisi kullanılır; animasyon anlık paket aralıklarında durup başlamaz. Gölgeler ve uzaktaki ayrıntılar kalite düzeyine göre azaltılır.

Görsel kontrol, normal HTTP geliştirme önizlemesinde yapılır. Yerel file:// adresi tarayıcı araçlarının URL ilkesiyle engellendiğinden araçla dosyaya çift tıklama kontrolü yapılmış sayılmaz. Ayrı varlık paketi ve klasik JavaScript giriş yolu otomatik dosya/başlatıcı testleriyle kontrol edilir.
