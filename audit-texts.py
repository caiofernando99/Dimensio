import re
import pathlib

pt_re = re.compile(r'[ÃÕãõÇçÁÉÍÓÚáéíóúâêîôûàèìòù]')
tot = 0
per_file = {}
for p in list(pathlib.Path('src').rglob('*.tsx')) + list(pathlib.Path('src').rglob('*.ts')):
    if 'locales' in p.parts or '.test.' in p.name:
        continue
    n = 0
    for line in p.read_text(encoding='utf-8').splitlines():
        s = line.strip()
        if s.startswith('import ') or s.startswith('//') or s.startswith('*'):
            continue
        if pt_re.search(line) and ('"' in line or "'" in line or '>' in line):
            n += 1
    if n:
        per_file[str(p)] = n
        tot += n
print('TOTAL linhas com PT hardcoded:', tot)
for f, n in sorted(per_file.items(), key=lambda x: -x[1])[:30]:
    print(f'{n:4d}  {f}')
