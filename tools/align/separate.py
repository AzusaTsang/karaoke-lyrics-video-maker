#!/usr/bin/env python3
"""Separate the vocals from a song (or a video's soundtrack) with Demucs (htdemucs).

Writes two files into --out-dir:
  vocals_44k.wav   full-quality stereo vocals (44.1 kHz) - handy for listening / checking
  vocals_16k.wav   mono 16 kHz vocals - this is what align.py needs

Example:
  python separate.py --input song.mp4 --out-dir work
"""
import argparse
import os
import subprocess

import common


def main():
    ap = argparse.ArgumentParser(
        description='Vocal separation with Demucs (htdemucs). ffmpeg decodes the input, so any audio or video file works.')
    ap.add_argument('--input', required=True, help='audio or video file (anything ffmpeg can read)')
    ap.add_argument('--out-dir', required=True, help='output directory (created if missing)')
    ap.add_argument('--device', default='auto', choices=['auto', 'cuda', 'cpu'],
                    help='compute device (default: auto = CUDA if available, else CPU)')
    ap.add_argument('--keep-mix', action='store_true', help='keep the decoded 44.1 kHz mix (mix_44k.wav) in --out-dir')
    args = ap.parse_args()

    if not os.path.isfile(args.input):
        common.die('input file not found: %s' % args.input)
    ffmpeg = common.need_ffmpeg()
    torch = common.need('torch', 'torch', 'running Demucs')
    sf = common.need('soundfile', 'soundfile', 'reading / writing wav files')
    common.need('demucs', 'demucs', 'vocal separation')
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    os.makedirs(args.out_dir, exist_ok=True)
    device = common.pick_device(torch, args.device)

    mix_path = os.path.join(args.out_dir, 'mix_44k.wav')
    print('decoding with ffmpeg ...')
    try:
        subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', args.input, '-vn', '-ac', '2', '-ar', '44100', mix_path],
                       check=True)
    except subprocess.CalledProcessError:
        common.die('ffmpeg could not decode %s (does it contain an audio track?)' % args.input)
    x, sr = sf.read(mix_path, dtype='float32')
    x = torch.from_numpy(x.T)                                   # (channels, samples)

    print('loading htdemucs (first run downloads the model) on %s ...' % device)
    model = get_model('htdemucs').to(device).eval()
    ref = x.mean(0)
    std = ref.std().clamp_min(1e-8)
    xn = (x - ref.mean()) / std
    print('separating (this can take a few minutes) ...')
    with torch.no_grad():
        out = apply_model(model, xn[None].to(device), device=device, split=True, overlap=0.25)[0]
    v = out[model.sources.index('vocals')].cpu() * std + ref.mean()

    p44 = os.path.join(args.out_dir, 'vocals_44k.wav')
    p16 = os.path.join(args.out_dir, 'vocals_16k.wav')
    sf.write(p44, v.numpy().T, sr)
    v16 = torch.nn.functional.interpolate(v.mean(0)[None, None], scale_factor=16000 / sr, mode='linear')[0, 0]
    sf.write(p16, v16.numpy(), 16000)
    if not args.keep_mix:
        try:
            os.remove(mix_path)
        except OSError:
            pass
    print('done:\n  %s\n  %s' % (p44, p16))


if __name__ == '__main__':
    main()
