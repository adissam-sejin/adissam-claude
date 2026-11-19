"""Contact sheets of rendered frames (QA). usage: sheet.py start end step out_prefix"""
import sys, os, numpy as np, cv2
import post, timeline as TL
a, b, st = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
pre = sys.argv[4]
rng = np.random.default_rng(1)
ims = []
for fr in range(a, b + 1, st):
    p = os.environ.get('WORK', '/tmp/babypov') + '/exr/f%04d.exr' % fr
    if not os.path.exists(p):
        continue
    img = post.read_exr(p)
    e = post.Exposure()
    x = post.grade(img, max(fr / TL.FPS, 0.8), e.step(img, 1 / 24), rng, (480, 270))
    x = (x[..., ::-1] * 255 + 0.5).astype(np.uint8)
    cv2.putText(x, '%d %.1fs' % (fr, fr / 24), (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2)
    ims.append(x)
k = 0
for i in range(0, len(ims), 12):
    c = ims[i:i + 12]
    c += [np.zeros_like(ims[0])] * (12 - len(c))
    cv2.imwrite('%s%d.jpg' % (pre, k), np.vstack([np.hstack(c[j:j + 4]) for j in (0, 4, 8)]))
    k += 1
print(len(ims), 'frames ->', k, 'sheets')
