"""Anonymize a pw-dump (stdin -> stdout): user, host, machine id, MAC addresses, Bluetooth device names,
and stream titles (media.name: browser tab titles, song names), which the Apps list shows.
Two passes: collect the private strings first, then replace them everywhere, since they also turn up in
port aliases and format/tag params."""
import getpass, json, re, socket, sys

user, host = getpass.getuser(), socket.gethostname()
MAC = re.compile(r'(?i)([0-9a-f]{2})([:_])(?:[0-9a-f]{2}\2){4}[0-9a-f]{2}')
NAMES = ('device.alias', 'device.description', 'device.nick', 'node.description', 'node.nick', 'api.bluez5.alias')
# Neutral stand-ins for stream titles, handed out in order of appearance.
TITLES = ['Lo-fi beats to code to', 'Weekly team call', 'Podcast: The Linux audio stack', 'Conference talk: PipeWire 1.6',
          'Album: Synthwave Nights', 'Tutorial: WirePlumber scripting', 'Notification sound', 'Radio stream']
KEEP_TITLES = ('playback', 'Peak detect')

def collect(x, repl, bluez=False):
    if isinstance(x, dict):
        bluez = bluez or str(x.get('device.api', '')) == 'bluez5' or str(x.get('node.name', '')).startswith('bluez_')
        for k, v in x.items():
            if not isinstance(v, str) or not v:
                collect(v, repl, bluez)
            elif bluez and k in NAMES:
                repl.setdefault(v, 'Bluetooth device')
            elif k == 'media.name' and str(x.get('media.class', '')).startswith('Stream/') \
                    and v not in KEEP_TITLES and not v.startswith('Bluetooth internal'):
                n = sum(1 for r in repl.values() if r in TITLES)
                repl.setdefault(v, TITLES[n % len(TITLES)])
    elif isinstance(x, list):
        for v in x: collect(v, repl, bluez)

def apply(x, repl, order):
    if isinstance(x, dict):
        return {apply(k, repl, order): ('0' * 32 if k == 'application.process.machine-id' else apply(v, repl, order)) for k, v in x.items()}
    if isinstance(x, list): return [apply(v, repl, order) for v in x]
    if not isinstance(x, str): return x
    for old in order:  # longest first, so "SRS-XB30 output" is not half-replaced by "SRS-XB30"
        if old in x: x = x.replace(old, repl[old])
    x = MAC.sub(lambda m: '{1}'.join(['00', '11', '22', '33', '44', '55']).format(None, m.group(2)), x)
    return x.replace(user, 'user').replace(host, 'host')

dump = json.load(sys.stdin)
repl = {}
collect(dump, repl)
order = sorted((k for k in repl if len(k) >= 3), key=len, reverse=True)
json.dump(apply(dump, repl, order), sys.stdout, indent=1)
