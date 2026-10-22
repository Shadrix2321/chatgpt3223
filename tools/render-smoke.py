"""Controlled visual checks against the real renderer, without modifying game state."""
import json
import os
import subprocess
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
fixture = Path('/tmp/son-koridor-renderer-probe.js')
BASE = os.environ.get('SMOKE_URL', 'http://127.0.0.1:8001')
subprocess.run(['node', '--input-type=module', '-e', "import{build}from'esbuild';import{writeFile}from'node:fs/promises';const r=await build({entryPoints:['src/renderer.mjs'],bundle:true,format:'iife',globalName:'RendererQA',write:false,minify:true,target:'es2020'});await writeFile('/tmp/son-koridor-renderer-probe.js',r.outputFiles[0].contents);"], cwd=ROOT, check=True)
report = {'checks': [], 'errors': []}
def check(name, ok, **data):
    report['checks'].append({'name':name,'passed':bool(ok),**data})
    print(name, 'PASS' if ok else 'FAIL', data, flush=True)
    assert ok, name

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    try:
        page = browser.new_page(viewport={'width':1280,'height':720})
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.goto(BASE + '/health')
        page.set_content('<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block}</style><canvas id="probe"></canvas>')
        page.add_script_tag(content=fixture.read_text())
        page.evaluate('''async () => {
          window.qa = await RendererQA.Lg(document.getElementById('probe'));
          qa.quality('ultraLow');
          qa.camera.position.set(0, 1.72, 120); qa.camera.lookAt(0,1.72,80);
          window.sceneState = {phase:'playing',night:1,blackout:false,fallenShelves:[],players:[{id:'me',x:0,z:120,lives:3,online:true}],locust:{x:0,z:100,yaw:Math.PI,moving:false,state:'patrol',speed:0}};
          qa.setItems([{id:'probe-food',model:'carton',x:4.65,y:1.3,z:108,ownerId:'me'}],'me');
          window.draw = async (blackout,torch) => {
            sceneState.blackout=blackout;
            for(let i=0;i<12;i++) {qa.update(sceneState,'me',1/30,performance.now()/1000,torch);qa.renderer.render();await new Promise(requestAnimationFrame);}
            return {...qa.metrics};
          };
        }''')
        normal = page.evaluate('draw(false, false)')
        page.screenshot(path=str(OUT/'render-normal.png'))
        bounds = page.evaluate('''() => {
          let box=null;for(const r of qa.monster.findComponents('render'))for(const mi of r.meshInstances){if(!box)box=mi.aabb.clone();else box.add(mi.aabb);}
          return {height:box.halfExtents.y*2,width:box.halfExtents.x*2,depth:box.halfExtents.z*2};
        }''')
        check('Locust GLB remains upright at intended scale', 3 < bounds['height'] < 7 and bounds['height'] > bounds['depth'], **bounds)
        off = page.evaluate('draw(true, false)')
        page.screenshot(path=str(OUT/'render-blackout-off.png'))
        on = page.evaluate('draw(true, true)')
        page.screenshot(path=str(OUT/'render-blackout-on.png'))
        images = [Image.open(OUT/n).convert('RGB') for n in ['render-normal.png','render-blackout-off.png','render-blackout-on.png']]
        # Central floor/aisle excludes most of the fixed local cart.
        region=(40,160,1240,620)
        normal_brightness=sum(ImageStat.Stat(images[0].crop(region)).mean)/3
        dark_brightness=sum(ImageStat.Stat(images[1].crop(region)).mean)/3
        torch_difference=sum(ImageStat.Stat(ImageChops.difference(images[1].crop(region),images[2].crop(region))).mean)/3
        check('Blackout darkens the actual world in very-low mode', dark_brightness < normal_brightness*.8, normal=normal_brightness, blackout=dark_brightness)
        check('Flashlight illuminates the world in very-low mode', torch_difference > 2, mean_pixel_difference=torch_difference)
        projection = page.evaluate('qa.camera.worldToScreen({x:0,y:1.72,z:110})')
        check('Reduced-resolution markers stay centered in CSS pixels', abs(projection['x']-640)<2 and abs(projection['y']-360)<2 and projection['z']>0, **projection)
        report['renderer'] = on
        check('No renderer runtime errors', not report['errors'], errors=report['errors'])
    finally:
        (OUT/'render-smoke.json').write_text(json.dumps(report,indent=2))
        browser.close()
