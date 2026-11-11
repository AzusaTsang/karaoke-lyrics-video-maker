#!/usr/bin/env python3
"""Per-character forced alignment of SRT lyrics against separated vocals (torchaudio MMS_FA).

Input : an .srt file (one cue per lyric line) and vocals_16k.wav from separate.py
Output: a JSON array  [{id, start, end, text, score, units:[{t, r, t0, t1}]}]
        that the Karaoke Lyrics Video Maker can import directly ("Import SRT / JSON...").

Modes
  window  each cue is aligned independently inside its SRT time +/- --pad seconds (robust, default)
  global  the whole song is aligned in a single pass (can fix SRT times that are rough, but one wrong
          line may drag its neighbours); any cue whose first sung character lands more than
          --max-offset seconds from its SRT start is re-aligned in window mode.

Languages (--lang auto, per cue)
  Japanese (any kana in the line)  readings via pykakasi, furigana on kanji blocks, mora-level tokens
  Chinese  (CJK without kana)      characters aligned through pinyin, no ruby is added
  other    (Latin, Cyrillic ...)   word-level alignment, accents stripped / Cyrillic transliterated

Example:
  python align.py --srt song.srt --vocals work/vocals_16k.wav --out aligned.json
"""
import argparse
import json
import statistics
import sys

import common


def load_vocals(path, torch, sf):
    try:
        wav, sr = sf.read(path, dtype='float32')
    except Exception as e:
        common.die('cannot read %s: %s' % (path, e))
    if sr != 16000:
        common.die('%s is %d Hz, but alignment needs 16000 Hz mono. Use vocals_16k.wav written by separate.py, '
                   'or convert with: ffmpeg -i in.wav -ac 1 -ar 16000 out.wav' % (path, sr))
    if wav.ndim == 2:
        wav = wav.mean(1)
    return torch.from_numpy(wav)[None]


def forced_spans(torchaudio, em, ids, f_off, fps):
    """CTC forced alignment of token ids against emission `em` (T, C) -> [(t0, t1, score)] in seconds."""
    import torch
    tgt = torch.tensor([ids], dtype=torch.int32, device=em.device)
    al, sc = torchaudio.functional.forced_align(em[None], tgt, blank=0)
    sp = torchaudio.functional.merge_tokens(al[0].cpu(), sc[0].exp().cpu())
    if len(sp) != len(ids):
        raise RuntimeError('token count mismatch (%d vs %d)' % (len(sp), len(ids)))
    return [((f_off + s.start) / fps, (f_off + s.end) / fps, float(s.score)) for s in sp]


def usable_tokens(plan, lid):
    return [(k, t) for k, t in plan.tokens if t in lid]


def align_window(plan, cue, em, fps, lid, pad, torchaudio):
    """-> (units, score) or (None, error-string)"""
    toks = usable_tokens(plan, lid)
    f0 = max(0, int((cue['start'] - pad) * fps))
    f1 = min(em.shape[0], int((cue['end'] + pad) * fps) + 1)
    need = len(toks) if plan.kind == 'mora' else len(toks) * 1.2     # frames must comfortably exceed tokens
    if not toks or f1 - f0 <= need:
        return None, 'no tokens' if not toks else 'window too short for %d tokens' % len(toks)
    try:
        spans = forced_spans(torchaudio, em[f0:f1], [lid[t] for _, t in toks], f0, fps)
        return common.units_from_alignment(plan, toks, spans, cue['start']), None
    except Exception as e:                                           # CTC cannot fit the tokens in the window
        return None, repr(e)[:120]


def make_record(cue, plan, result, err):
    rec = dict(cue)
    if result is not None:
        rec['score'] = result[1]
        rec['units'] = result[0]
    else:
        rec['score'] = None
        rec['units'] = common.even_split(plan, cue)                  # fall back to even split over the SRT time
        rec['fallback'] = True
        if err and err != 'no tokens':
            rec['err'] = err
    return rec


def main():
    ap = argparse.ArgumentParser(
        description='Per-character forced alignment of SRT lyrics against vocals (torchaudio MMS_FA). '
                    'Output is a draft: expect to fix lines in the editor.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='The MMS_FA model (~1.2 GB) is downloaded on first run.')
    ap.add_argument('--srt', required=True, help='lyrics as .srt (one cue per line of lyrics)')
    ap.add_argument('--vocals', required=True, help='vocals_16k.wav (mono, 16 kHz) from separate.py')
    ap.add_argument('--out', required=True, help='output JSON file')
    ap.add_argument('--mode', choices=['window', 'global'], default='window',
                    help='window: align each cue inside its SRT time (default); global: one pass over the whole song')
    ap.add_argument('--lang', choices=['auto', 'ja', 'other'], default='auto',
                    help='auto: detect per cue (kana -> Japanese, CJK -> Chinese, else word-level); '
                         'ja: treat every cue as Japanese; other: never use the Japanese path (default: auto)')
    ap.add_argument('--max-offset', type=float, default=0.8, metavar='SEC',
                    help='global mode: re-align a cue in window mode when its first sung character lands more than '
                         'SEC seconds from the SRT start (default: 0.8)')
    ap.add_argument('--pad', type=float, default=0.35, metavar='SEC',
                    help='window mode: seconds of context added around each cue (default: 0.35)')
    ap.add_argument('--low-score', type=float, default=0.1, metavar='S',
                    help='list cues scoring below S in the summary (default: 0.1; scores on singing are usually low)')
    ap.add_argument('--device', choices=['auto', 'cuda', 'cpu'], default='auto', help='default: auto')
    args = ap.parse_args()

    torch = common.need('torch', 'torch', 'the alignment model')
    torchaudio = common.need('torchaudio', 'torchaudio', 'the alignment model')
    sf = common.need('soundfile', 'soundfile', 'reading wav files')
    common.need('numpy', 'numpy')
    import numpy as np
    from torchaudio.pipelines import MMS_FA as bundle

    cues = common.parse_srt(args.srt)
    plans = [common.plan_cue(c['text'], args.lang) for c in cues]    # also validates pykakasi / pypinyin early
    wav = load_vocals(args.vocals, torch, sf)
    device = common.pick_device(torch, args.device)

    print('loading MMS_FA (first run downloads ~1.2 GB) on %s ...' % device)
    model = bundle.get_model(with_star=False).to(device).eval()
    lid = {c: i for i, c in enumerate(bundle.get_labels())}
    with torch.inference_mode():
        em_dev = torch.log_softmax(model(wav.to(device))[0], -1)[0]   # (T, C), about 50 frames per second
    fps = em_dev.shape[0] / (wav.shape[1] / 16000)
    em_cpu = em_dev.cpu()
    print('%d cues, %d frames (%.1f fps)' % (len(cues), em_dev.shape[0], fps))

    out = []
    redone = []
    if args.mode == 'window':
        for cue, plan in zip(cues, plans):
            res, err = align_window(plan, cue, em_cpu, fps, lid, args.pad, torchaudio)
            out.append(make_record(cue, plan, res, None if res else err))
    else:
        # whole song in one pass: concatenate every cue's tokens, align once, then split the result per cue
        per_cue = [usable_tokens(p, lid) for p in plans]
        ids = [lid[t] for toks in per_cue for _, t in toks]
        if not ids:
            common.die('no alignable text found in %s' % args.srt)
        print('global alignment: %d tokens over %d frames ...' % (len(ids), em_dev.shape[0]))
        try:
            spans = forced_spans(torchaudio, em_dev, ids, 0, fps)
        except Exception as e:
            common.die('global alignment failed (%r). The lyrics probably have more tokens than the audio has frames; '
                       'try --mode window.' % e)
        pos = 0
        for cue, plan, toks in zip(cues, plans, per_cue):
            sp = spans[pos:pos + len(toks)]
            pos += len(toks)
            res = common.units_from_alignment(plan, toks, sp, cue['start']) if toks else None
            rec = make_record(cue, plan, res, None)
            off = common.first_onset_offset(rec) if res else None
            if res and (off is None or abs(off) > args.max_offset):
                w_res, w_err = align_window(plan, cue, em_cpu, fps, lid, args.pad, torchaudio)
                rec = make_record(cue, plan, w_res, w_err)
                redone.append((cue['id'], None if off is None else round(off, 2), 'window' if w_res else 'even split'))
            out.append(rec)

    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    # ---- summary -------------------------------------------------------
    scores = [r['score'] for r in out if r['score'] is not None]
    fb = [r for r in out if r.get('fallback')]
    print('\nwrote %s: %d cues, %d with even-split fallback' % (args.out, len(out), len(fb)))
    if scores:
        print('score: median %.3f, %d below %.2f' % (statistics.median(scores), sum(s < args.low_score for s in scores), args.low_score))
    offs = [o for o in (common.first_onset_offset(r) for r in out if not r.get('fallback')) if o is not None]
    if offs:
        p10, p90 = np.percentile(offs, [10, 90])
        print('first character vs SRT start: median %.2f s, p10/p90 %.2f/%.2f s' % (np.median(offs), p10, p90))
    if redone:
        print('global mode re-aligned %d cue(s) (id, offset s, result): %s' % (len(redone), redone))
    for r in out:
        if r.get('fallback') or (r['score'] is not None and r['score'] < args.low_score):
            print('  check #%s [%s] score=%s%s' % (r['id'], r['text'][:40],
                                                 None if r['score'] is None else round(r['score'], 3),
                                                 ' (fallback: %s)' % r['err'] if r.get('err') else (' (fallback)' if r.get('fallback') else '')))
    print('Import the JSON in the app via "Import SRT / JSON..." and fix lines in the editor.')


if __name__ == '__main__':
    sys.exit(main())
