(function(){
 const script=document.currentScript;
 const heading=document.querySelector('#loading b'),status=document.getElementById('loadtext');
 function report(title,text){heading.textContent=title;status.textContent=text;status.style.cssText='max-width:560px;padding:0 24px;line-height:1.8;text-align:center;white-space:pre-line';}
 function load(src,onload){const tag=document.createElement('script');tag.src=src;tag.onload=onload;tag.onerror=()=>report('Oyun dosyası bulunamadı.','ZIP dosyasının tamamını aynı klasöre çıkart. index.html, oyun kodu, game.css ve assets klasörü birlikte kalmalı.');document.head.append(tag)}
 function start(){load(script.dataset.runtime||'game.js')}
 // Classic scripts and a separate asset pack allow file:// launch without modules
 // or fetches to the local filesystem. The HTML remains an entry point only.
 if(location.protocol==='file:')load(script.dataset.local,start);else start();
})();
