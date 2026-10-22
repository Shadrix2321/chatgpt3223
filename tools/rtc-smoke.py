"""Network-only real Chromium smoke. Does not need the renderer or alter browser policies."""
import json
from datetime import datetime, timezone
from pathlib import Path
import subprocess
import tempfile
import time

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
POLICY = Path('/etc/chromium/policies/managed/misc.json')


def main():
    policy_blocks_udp = False
    if POLICY.is_file():
        policy_blocks_udp = json.loads(POLICY.read_text()).get('WebRtcIPHandling') == 'disable_non_proxied_udp'
    with tempfile.TemporaryDirectory(prefix='son-koridor-rtc-') as temporary:
        bundle = Path(temporary) / 'network.js'
        subprocess.run(['node', 'node_modules/esbuild/bin/esbuild', 'src/network.mjs', '--bundle', '--format=iife', '--global-name=SonKoridorNetwork', '--outfile=' + str(bundle)], cwd=ROOT, check=True)
        server = subprocess.Popen(['node', '--input-type=module', '-e', "import {createGameServer} from './server.mjs';const service=createGameServer();const address=await service.listen(0);console.log(address.port);"], cwd=ROOT, stdout=subprocess.PIPE, text=True)
        try:
            port = server.stdout.readline().strip()
            if not port.isdigit():
                raise AssertionError('The ephemeral network test server did not start.')
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
                host = browser.new_context().new_page()
                guest = browser.new_context().new_page()
                runtime_errors = []
                for page in [host, guest]:
                    page.on('pageerror', lambda error: runtime_errors.append(str(error)))
                    page.goto(f'http://127.0.0.1:{port}/health')
                    page.add_script_tag(content=bundle.read_text())
                    page.evaluate("""() => { window.iceCandidateEvents = 0; window.signaledCandidates = 0;
                      window.game = new SonKoridorNetwork.Mh({ rtcFactory: config => {
                        const pc = new RTCPeerConnection(config);
                        pc.addEventListener('icecandidate', event => { if (event.candidate) window.iceCandidateEvents++; });
                        return pc;
                      }});
                      const sendSignal = game._sendSignal.bind(game);
                      game._sendSignal = (to, data) => { if (data.candidate) window.signaledCandidates++; return sendSignal(to, data); };
                    }
                    """)
                created = host.evaluate("game.create({name:'Host',maxPlayers:2})")
                joined = guest.evaluate("code => game.join({name:'Guest',code})", created['state']['code'])
                host.evaluate("game.request('start')")
                host.wait_for_function("[...game.peers.values()].some(peer => peer.pc?.remoteDescription?.type === 'answer')", timeout=10000)
                guest.wait_for_function("game.peers.get(game.hostId)?.pc?.remoteDescription?.type === 'offer'", timeout=10000)
                deadline = time.monotonic() + (3 if policy_blocks_udp else 15)
                while time.monotonic() < deadline:
                    if guest.evaluate("game.stats.peers[0]?.directReady && game.peers.get(game.hostId).samples.rtc.length >= 3"):
                        break
                    guest.wait_for_timeout(250)
                inspect = """async () => ({
                  stats: game.stats,
                  iceCandidateEvents: window.iceCandidateEvents,
                  signaledCandidates: window.signaledCandidates,
                  peers: await Promise.all([...game.peers.values()].map(async peer => {
                    const reports = peer.pc ? [...(await peer.pc.getStats()).values()] : [];
                    return {
                      signaling: peer.pc?.signalingState,
                      localDescription: peer.pc?.localDescription?.type,
                      remoteDescription: peer.pc?.remoteDescription?.type,
                      connection: peer.pc?.connectionState,
                      iceConnection: peer.pc?.iceConnectionState,
                      localCandidateCount: reports.filter(report => report.type === 'local-candidate').length,
                      remoteCandidateCount: reports.filter(report => report.type === 'remote-candidate').length,
                      shareableLocalCandidateCount: (peer.pc?.localDescription?.sdp?.match(/^a=candidate:/gm) || []).length,
                      rtcSamples: peer.samples.rtc.length,
                      relaySamples: peer.samples.relay.length
                    };
                  }))
                })"""
                before = {'host': host.evaluate(inspect), 'guest': guest.evaluate(inspect)}
                direct_ready = before['guest']['stats']['peers'][0]['directReady']
                if direct_ready:
                    # Send a genuine RPC over the already-open native RTC channel.
                    guest.evaluate("game.peers.get(game.hostId).transport = 'rtc'")
                    direct = guest.evaluate("game.request('sync',{seq:100,move:{x:0,z:148,yaw:0,crouch:true}})")
                    assert direct['state']['phase'] == 'playing'
                    guest.evaluate('game.peers.get(game.hostId).dc.close()')
                    guest.wait_for_function("game.stats.transport === 'relay' && !game.stats.peers[0].directReady")
                    direct_outcome = 'native_data_channel_and_relay_failover_passed'
                else:
                    no_candidates = all(state['iceCandidateEvents'] == 0 and state['signaledCandidates'] == 0 and all(peer['shareableLocalCandidateCount'] == 0 for peer in state['peers']) for state in before.values())
                    assert policy_blocks_udp and no_candidates, f'Unexpected native RTC failure: {before}'
                    direct_outcome = 'unverified_managed_udp_policy_exposes_zero_shareable_ice_candidates'
                relayed = guest.evaluate("game.request('sync',{seq:101,move:{x:0,z:148,yaw:0,crouch:false}})")
                player = next(player for player in relayed['state']['players'] if player['id'] == joined['me'])
                assert player['crouch'] is False
                assert relayed['state']['phase'] == 'playing'
                assert len(relayed['state']['players']) == 2
                assert not runtime_errors, runtime_errors
                report = {
                    'verifiedAt': datetime.now(timezone.utc).isoformat(),
                    'test': 'network-only real Chromium, two separate browser contexts',
                    'offerAnswerExchange': 'passed',
                    'relayJoinStartSync': 'passed',
                    'nativeRtc': direct_outcome,
                    'managedPolicyEvidence': str(POLICY) + ': WebRtcIPHandling=disable_non_proxied_udp' if policy_blocks_udp else None,
                    'before': before,
                    'after': guest.evaluate('game.stats'),
                    'runtimeErrors': runtime_errors,
                    'productionCrossNetwork': 'not tested; no public deployment performed',
                }
                output = ROOT / 'artifacts' / 'rtc-smoke.json'
                output.parent.mkdir(exist_ok=True)
                output.write_text(json.dumps(report, indent=2) + '\n')
                print(json.dumps(report, indent=2))
                guest.evaluate('game.close()')
                host.evaluate('game.close()')
                browser.close()
        finally:
            server.terminate()
            server.wait(timeout=5)


if __name__ == '__main__':
    main()
