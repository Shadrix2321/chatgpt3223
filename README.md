# Son Koridor — PlayCanvas çalışma kopyası

Ana depo `/workspace/yazilimindirvip` değiştirilmedi. Doğrulanmış tam yedek
`/workspace/backups/yazilimindirvip-original-2026-10-22.tar.gz` dosyasındadır.
Bu klasör bağımsız çalışma kopyasıdır; Git worktree oluşturmak gerekmez.

Node.js 24 ile bu klasörde:

```sh
npm ci --cache /workspace/.cache/npm --ignore-scripts
npm run build
npm test
npm start
```

Sunucu varsayılan olarak yalnızca bu makinede, `127.0.0.1:8001` üzerinde çalışır.
Bulut ortamında yerel HTTP istekleriyle doğrulanır. Herkese açık bir site için
WebSocket destekleyen bir Node sunucusunda HTTPS ile yayımlamak gerekir;
ayrıntılar [çok oyunculu kurulumunda](docs/MULTIPLAYER.md).

- Oyun görüntülemesi PlayCanvas Engine kullanır. Eski Three.js paketi yüklenmez.
- Otomatik, çok düşük, düşük, orta ve yüksek grafik seçenekleri vardır.
  Eski PC için çok düşük ve 30 FPS ile başlayın. WebGL 2 destekli tarayıcı gerekir.
- Çözünürlük ve görüş mesafesi sınırlandırılır; raf geometrisi bölümler halinde
  birleştirilir. Uzak detaylar ve animasyonlar işlenmez; gerçek zamanlı gölge yoktur.
- Yeni gece herkesi üç cana döndürür. Elenen oyuncular da yeniden katılır;
  kampanya boyunca toplanan ürün sayıları korunur.
- Eğilirken göz sepet tutacağının altına iner; ön taraf açık tel ızgaradır.
- Locust bütün marketi dolaşır; görüş, gürültü, son görülen konum ve arama
  davranışı kullanır. Güvenli alan, kişisel listeler ve on saniye teslimat korunur.
- Oda bağlantısı sunucu aktarımıyla hemen çalışır. WebRTC yolu da denenir;
  ölçülen gecikme ve kararlılığa göre aktarım yolu seçilir ve arızada değiştirilir.

Kaynak: `src/client.mjs` arayüz/kontrol, `renderer.mjs` PlayCanvas,
`simulation.mjs` oyun/yapay zekâ, `world.mjs` harita/çarpışma,
`network.mjs` bağlantı, `server.mjs` dosya/sinyal/aktarım sunucusu.

```sh
# npm start başka bir terminalde çalışırken:
python3 tools/browser-smoke.py
```

Tarayıcı testi kurulu Chromium ve Python Playwright kullanır; sonuçlar
`test-results/` içine yazılır. Yazılım tabanlı SwiftShader ölçümleri gerçek eski
PC performansının garantisi değildir. Asıl donanımda ölçerek ayar seçin.

`game-2ed016e2e6.js`, `assets-local.js` ve önceki doğrulama belgesi eski dağıtıma
aittir. Yeni HTML yalnızca derlenen `game-playcanvas.js` dosyasını açar.
Bu sürüm HTTP sunucusu kullanır; dosyaya çift tıklayarak çalıştırma yolu kullanılmaz.

Varlıkların kaynak ve lisans bilgileri [SOURCES.md](SOURCES.md) içindedir.
PlayCanvas lisansı derleme sırasında `assets/LICENSE-playcanvas.txt` olarak eklenir.
