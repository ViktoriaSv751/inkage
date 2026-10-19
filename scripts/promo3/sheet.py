import sys,glob
from PIL import Image
import os; pre=sys.argv[1]; fs=[os.environ.get('O','out')+f'/{pre}-{i}.png' for i in sys.argv[2].split(',')]
ims=[Image.open(f).convert('RGB') for f in fs]; h=1000
ims=[i.resize((int(i.width*h/i.height),h),Image.LANCZOS) for i in ims]
W=sum(i.width for i in ims)+12*(len(ims)-1); s=Image.new('RGB',(W,h),(200,200,205)); x=0
for i in ims: s.paste(i,(x,0)); x+=i.width+12
s.save(sys.argv[3],quality=85)
