"""Find this Mac's active local IPv4 address without assuming Wi-Fi is en0."""
import ipaddress
import subprocess

def local_address():
    route = subprocess.run(['route', '-n', 'get', 'default'], capture_output=True, text=True)
    active = [line.split(':', 1)[1].strip() for line in route.stdout.splitlines() if line.strip().startswith('interface:')]
    for interface in dict.fromkeys(['en0', *active]):
        result = subprocess.run(['ipconfig', 'getifaddr', interface], capture_output=True, text=True)
        try:
            address = ipaddress.ip_address(result.stdout.strip())
            if address.version == 4 and address.is_private and not address.is_loopback and not address.is_unspecified:
                return str(address)
        except ValueError:
            continue
    raise SystemExit('Connect this Mac to the same local network as your phone, then run the launcher again.')
