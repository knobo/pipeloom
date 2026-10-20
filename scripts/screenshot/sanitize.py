"""Anonymize a pw-dump (stdin -> stdout): user, host, machine id, MAC addresses, Bluetooth device names."""
import getpass, json, re, socket, sys

user, host = getpass.getuser(), socket.gethostname()
MAC = re.compile(r'(?i)([0-9a-f]{2})([:_])(?:[0-9a-f]{2}\2){4}[0-9a-f]{2}')
NAMES = ('device.alias', 'device.description', 'device.nick', 'node.description', 'node.nick', 'api.bluez5.alias')

def text(s):
    s = MAC.sub(lambda m: '{1}'.join(['00', '11', '22', '33', '44', '55']).format(None, m.group(2)), s)
    return s.replace(user, 'user').replace(host, 'host')

def walk(x, bluez=False):
    if isinstance(x, dict):
        bluez = bluez or str(x.get('device.api', '')) == 'bluez5' or str(x.get('node.name', '')).startswith('bluez_')
        out = {}
        for k, v in x.items():
            if k == 'application.process.machine-id': v = '0' * 32
            elif bluez and k in NAMES and isinstance(v, str): v = 'Bluetooth device'
            out[text(k)] = walk(v, bluez)
        return out
    if isinstance(x, list): return [walk(v, bluez) for v in x]
    return text(x) if isinstance(x, str) else x

json.dump(walk(json.load(sys.stdin)), sys.stdout, indent=1)
