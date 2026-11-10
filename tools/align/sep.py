import subprocess, numpy as np, torch, soundfile as sf
from demucs.pretrained import get_model
from demucs.apply import apply_model
# 44.1k 立体声原音（来自这一版视频本身）
subprocess.run(['ffmpeg','-v','error','-y','-i',r'V:\Adobe\focalors_inmu_king_1440p_srt.mp4','-vn','-ac','2','-ar','44100','work/mix44k.wav'],check=True)
x, sr = sf.read('work/mix44k.wav', dtype='float32'); x = torch.from_numpy(x.T)
m = get_model('htdemucs').cuda().eval()
ref = x.mean(0); xn = (x-ref.mean())/ref.std()
with torch.no_grad():
    out = apply_model(m, xn[None].cuda(), device='cuda', split=True, overlap=0.25)[0]
v = out[m.sources.index('vocals')].cpu()*ref.std()+ref.mean()
sf.write('work/vocals44k.wav', v.numpy().T, sr)
sf.write('work/vocals16k.wav', torch.nn.functional.interpolate(v.mean(0)[None,None], scale_factor=16000/sr, mode='linear')[0,0].numpy(), 16000)
print('done', v.shape)
