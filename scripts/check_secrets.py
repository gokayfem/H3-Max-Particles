"""Scan tracked files (or the initial working tree) without printing secret values."""
from pathlib import Path
import re, subprocess, sys

root = Path(__file__).resolve().parents[1]
tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
paths = [root / name for name in tracked if name] or [p for p in root.rglob('*') if p.is_file() and '.git' not in p.parts]
patterns = [
    rb'gh[pousr]_[A-Za-z0-9]{30,}',
    rb'github_pat_[A-Za-z0-9_]{30,}',
    rb'sk-[A-Za-z0-9_-]{24,}',
    rb'AKIA[0-9A-Z]{16}',
    rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    rb'https?://[^\s/:]+:[^\s/@]+@',
    rb'(?i)(?:api_key|api_secret|access_token|fal_key)\s*[=:]\s*["\x27][A-Za-z0-9:_-]{20,}["\x27]',
]
failures = []
for path in paths:
    rel = path.relative_to(root)
    if any(part in {'.openai', '.sites-runtime', 'node_modules'} for part in rel.parts) or path.name.startswith('.env') or path.suffix in {'.pem', '.key', '.log'}:
        failures.append(str(rel) + ': forbidden file')
    data = path.read_bytes()
    if any(re.search(pattern, data) for pattern in patterns):
        failures.append(str(rel) + ': possible credential')
    if path.suffix in {'.js', '.json', '.html', '.md', '.py'} and re.search(rb'(?i)[C-D]:[\\/](?:Users|h3-max-afterimage-collection)[\\/]', data):
        failures.append(str(rel) + ': private machine path')
if failures:
    print('\n'.join(failures)); sys.exit(1)
print(f'PASS: {len(paths)} files checked; no matched credentials, forbidden files, or private machine paths.')
