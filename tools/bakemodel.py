# Poly Haven (CC0) modelini yuklab, o'yin uchun ixcham ko'rinishga keltiradi:
#   python3 -I bakemodel.py <chiqish papkasi> <yuklash papkasi> <id> [<id> ...]
# Natija: <chiqish>/<id>.bin (cho'qqilar: joy, normal, uv — float32; indekslar — uint32), <id>_<m>_{d,n,a}.jpg, index.json
import json, os, struct, subprocess, sys, urllib.request, math

OUT, DL, IDS = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(OUT, exist_ok=True)

def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'model-fetch/1.0'})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, 'wb') as f: f.write(r.read())

def mat_mul(a, b): return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def node_matrix(n):
    if 'matrix' in n:
        m = n['matrix']; return [[m[c * 4 + r] for c in range(4)] for r in range(4)]   # ustunlar bo'yicha saqlangan
    t = n.get('translation', [0, 0, 0]); q = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = q
    R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[R[0][0] * s[0], R[0][1] * s[1], R[0][2] * s[2], t[0]], [R[1][0] * s[0], R[1][1] * s[1], R[1][2] * s[2], t[1]],
            [R[2][0] * s[0], R[2][1] * s[1], R[2][2] * s[2], t[2]], [0, 0, 0, 1]]

CT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def read_acc(g, bufs, ai):
    a = g['accessors'][ai]; bv = g['bufferViews'][a['bufferView']]; fmt, sz = CT[a['componentType']]; n = NC[a['type']]
    data = bufs[bv['buffer']]; off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride') or sz * n
    out = []
    for i in range(a['count']):
        v = struct.unpack_from('<' + fmt * n, data, off + i * stride)
        if a.get('normalized'):
            d = {'b': 127.0, 'B': 255.0, 'h': 32767.0, 'H': 65535.0}[fmt]; v = tuple(max(-1.0, x / d) for x in v)
        out.append(v)
    return out

index_path = os.path.join(OUT, 'index.json')
index = json.load(open(index_path)) if os.path.exists(index_path) else {}
for mid in IDS:
    d = os.path.join(DL, mid)
    info_p = os.path.join(d, 'files.json')
    get('https://api.polyhaven.com/files/' + mid, info_p)
    pk = json.load(open(info_p))['gltf']['1k']['gltf']
    gp = os.path.join(d, os.path.basename(pk['url'])); get(pk['url'], gp)
    for rel, v in pk['include'].items(): get(v['url'], os.path.join(d, rel))
    g = json.load(open(gp))
    bufs = [open(os.path.join(d, b['uri']), 'rb').read() for b in g['buffers']]
    parts = {}   # material raqami -> { pos, nor, uv, idx }
    def walk(ni, M):
        n = g['nodes'][ni]; W = mat_mul(M, node_matrix(n))
        if 'mesh' in n:
            for pr in g['meshes'][n['mesh']]['primitives']:
                if pr.get('mode', 4) != 4: continue
                at = pr['attributes']; P = read_acc(g, bufs, at['POSITION']); N = read_acc(g, bufs, at['NORMAL']) if 'NORMAL' in at else [(0, 1, 0)] * len(P)
                U = read_acc(g, bufs, at['TEXCOORD_0']) if 'TEXCOORD_0' in at else [(0, 0)] * len(P)
                I = [v[0] for v in read_acc(g, bufs, pr['indices'])] if 'indices' in pr else list(range(len(P)))
                p = parts.setdefault(pr.get('material', 0), {'pos': [], 'nor': [], 'uv': [], 'idx': []}); base = len(p['pos'])
                for (x, y, z) in P: p['pos'].append((W[0][0] * x + W[0][1] * y + W[0][2] * z + W[0][3], W[1][0] * x + W[1][1] * y + W[1][2] * z + W[1][3], W[2][0] * x + W[2][1] * y + W[2][2] * z + W[2][3]))
                for (x, y, z) in N:
                    nx, ny, nz = W[0][0] * x + W[0][1] * y + W[0][2] * z, W[1][0] * x + W[1][1] * y + W[1][2] * z, W[2][0] * x + W[2][1] * y + W[2][2] * z
                    l = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0; p['nor'].append((nx / l, ny / l, nz / l))
                p['uv'].extend((u[0], u[1]) for u in U); p['idx'].extend(base + i for i in I)
        for c in n.get('children', []): walk(c, W)
    I4 = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
    for ni in g['scenes'][g.get('scene', 0)]['nodes']: walk(ni, I4)
    allp = [v for p in parts.values() for v in p['pos']]
    mn = [min(v[k] for v in allp) for k in range(3)]; mx = [max(v[k] for v in allp) for k in range(3)]
    cx, cz, y0 = (mn[0] + mx[0]) / 2, (mn[2] + mx[2]) / 2, mn[1]
    blob = bytearray(); meta = {'bin': mid + '.bin', 'size': [round(mx[0] - mn[0], 4), round(mx[1] - mn[1], 4), round(mx[2] - mn[2], 4)], 'parts': [], 'tris': 0}
    def tex(ti, slot, mi, px):
        if ti is None: return None
        img = g['images'][g['textures'][ti['index']]['source']]['uri']; src = os.path.join(d, img); name = '%s_%d_%s.jpg' % (mid, mi, slot)
        subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', str(px), src, '--out', os.path.join(OUT, name)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return name
    for mi, p in sorted(parts.items()):
        m = g['materials'][mi] if 'materials' in g else {}; pbr = m.get('pbrMetallicRoughness', {})
        off = len(blob); v = len(p['pos'])
        blob += struct.pack('<%df' % (v * 3), *[c for (x, y, z) in p['pos'] for c in (x - cx, y - y0, z - cz)])
        blob += struct.pack('<%df' % (v * 3), *[c for n in p['nor'] for c in n])
        blob += struct.pack('<%df' % (v * 2), *[c for u in p['uv'] for c in u])
        blob += struct.pack('<%dI' % len(p['idx']), *p['idx'])
        meta['parts'].append({'off': off, 'v': v, 'i': len(p['idx']), 'd': tex(pbr.get('baseColorTexture'), 'd', mi, 1024), 'n': tex(m.get('normalTexture'), 'n', mi, 512),
                              'a': tex(pbr.get('metallicRoughnessTexture'), 'a', mi, 512), 'name': m.get('name', ''), 'alpha': m.get('alphaMode', 'OPAQUE')})
        meta['tris'] += len(p['idx']) // 3
    open(os.path.join(OUT, mid + '.bin'), 'wb').write(blob)
    import zlib
    meta['ver'] = '%08x' % (zlib.crc32(bytes(blob)) & 0xffffffff)
    index[mid] = meta
    print(mid, 'o\'lcham', meta['size'], 'uchburchak', meta['tris'], 'qism', len(meta['parts']), 'bin', len(blob) // 1024, 'KB', [(q['name'], q['d'], q['alpha']) for q in meta['parts']])
json.dump(index, open(index_path, 'w'), indent=1)
