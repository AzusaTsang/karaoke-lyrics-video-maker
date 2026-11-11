# Forced-alignment tools (optional)

**English** · [简体中文](#简体中文) · [日本語](#日本語)

The editor can import SRT files, but an SRT only has one start and end per line. These two scripts produce a
**per-character** timing draft, so you start from something close to the singing instead of from an even split:

1. `separate.py` isolates the vocals from a song or video with [Demucs](https://github.com/facebookresearch/demucs) (`htdemucs`).
2. `align.py` aligns your SRT lyrics to those vocals with the torchaudio **MMS_FA** CTC aligner and writes a JSON file the app can import.

| Language of a line | What happens |
| --- | --- |
| Japanese (contains kana) | Readings from [pykakasi](https://github.com/miurahr/pykakasi). Kanji blocks get furigana (okurigana is used to anchor where a reading ends), every other character is its own unit, timing is per mora. `漢字（カタカナ）` in the SRT uses the katakana in brackets as the furigana. |
| Chinese (CJK, no kana) | Aligned through pinyin ([pypinyin](https://github.com/mozillazg/python-pinyin)); no furigana is added. |
| Latin / Cyrillic (French, English, Russian, ...) | Word-level alignment (accents stripped, Cyrillic transliterated); the characters of a word share its time evenly. |

The language is detected per line, so a song can mix languages.

## Install

You need Python 3.9+ (checked on 3.11) and [ffmpeg](https://ffmpeg.org/) on your `PATH` (used by `separate.py` to decode the input).

```bash
cd tools/align
# 1. PyTorch first, ideally a CUDA build - choose the command for your system on https://pytorch.org/get-started/locally/
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
# 2. the rest
pip install -r requirements.txt
```

CPU-only works but is much slower (use `--device cpu`, or just let `--device auto` fall back). On first use two models are
downloaded automatically: the **MMS_FA alignment model (~1.2 GB)** by `align.py` and the Demucs `htdemucs` weights by `separate.py`.
If a dependency is missing, the scripts stop with a message that names the package to install.

## Usage, end to end

```bash
cd tools/align

# 1) vocals -> work/vocals_44k.wav (stereo, for listening) and work/vocals_16k.wav (mono 16 kHz, for alignment)
python separate.py --input "C:/music/song.mp4" --out-dir work

# 2) align the SRT (one cue per lyric line) to the vocals
python align.py --srt song.srt --vocals work/vocals_16k.wav --out aligned.json
```

Then in the app: **Load Media…** (the same song), then **Add lyrics…** → **Import an SRT / LRC / JSON file…** and choose `aligned.json`. Play it back and fix what is
wrong with the cursor, the timeline or `T` tap-to-time.

### `separate.py`

| Option | Meaning |
| --- | --- |
| `--input FILE` | Audio or video file (anything ffmpeg reads) |
| `--out-dir DIR` | Output folder (created if missing) |
| `--device auto\|cuda\|cpu` | Default `auto` |
| `--keep-mix` | Keep the decoded `mix_44k.wav` |

### `align.py`

| Option | Meaning |
| --- | --- |
| `--srt FILE` | Lyrics as SRT, one cue per line. Cue times should be roughly right: window mode only searches `--pad` seconds around each cue. The cue text becomes the displayed text |
| `--vocals FILE` | `vocals_16k.wav` (mono, 16 kHz) |
| `--out FILE` | Output JSON |
| `--mode window\|global` | `window` (default): each cue is aligned on its own inside its SRT time +/- `--pad` seconds. `global`: the whole song is aligned in one pass, which can fix rough SRT times; any cue whose first character ends up more than `--max-offset` seconds from its SRT start is re-aligned in window mode |
| `--lang auto\|ja\|other` | `auto` (default) detects per cue. `ja` treats every cue as Japanese. `other` never uses the Japanese path |
| `--max-offset SEC` | Global mode threshold, default `0.8` |
| `--pad SEC` | Window mode context around each cue, default `0.35` |
| `--low-score S` | Cues below this score are listed in the summary, default `0.1` |
| `--device auto\|cuda\|cpu` | Default `auto` |

Run `python align.py --help` for the full text. The summary printed at the end lists the cues that fell back to an even split
and the ones with a low score, which are the lines to check first.

### Output

A JSON array, one object per SRT cue:

```json
[
  {
    "id": 1, "start": 15.2, "end": 17.2, "text": "世界は君の声",
    "score": 0.41,
    "units": [
      {"t": "世界", "r": "せかい", "t0": 15.22, "t1": 15.98},
      {"t": "は",   "r": null,     "t0": 16.02, "t1": 16.2}
    ]
  }
]
```

`t` is the displayed character (or kanji block), `r` its furigana or `null`, `t0` / `t1` its start and end in seconds. A cue that could not
be aligned gets an even split over its SRT time plus `"fallback": true`; an `"err"` field may carry the reason. These two fields are
ignored by the app.

## Accuracy: read this

- Aligners are built for speech. **Scores on singing are low** (typically low), and a low score does not always mean wrong timing, nor a high one right timing.
- **Chorus, shouted, whispered, heavily layered or effect-processed lines are unreliable.** Backing vocals bleed through the separation and can attract the wrong characters.
- Long sustained notes, vowel runs and melisma give vague character boundaries.
- Global mode is only as good as the lyrics: one missing or extra line in the SRT can shift the neighbouring lines (that is what `--max-offset` and the window fallback are for).
- Furigana comes from a dictionary reader (pykakasi). Names, special readings and kanji used with unusual readings can be wrong; correct them in the editor.
- Treat the result as a **first draft** and fix it in the editor.

---

## 简体中文

这两个脚本为编辑器生成**逐字时间**的初稿：`separate.py` 用 Demucs 把人声从歌曲 / 视频里分离出来；`align.py` 用 torchaudio MMS_FA 把 SRT 歌词逐字对到人声上，输出可在应用里用「添加歌词…」→「导入 SRT / LRC / JSON 文件…」载入的 JSON。
日语行用 pykakasi 生成注音（汉字块加注音、送假名定位、按假名拍对齐），中文行借拼音对齐（不加注音），法 / 英 / 俄等按词对齐，每行自动判断语言。

```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128   # 建议 CUDA 版，按 pytorch.org 的命令选择
pip install -r requirements.txt                                                    # 另需 ffmpeg 在 PATH 中
python separate.py --input song.mp4 --out-dir work
python align.py --srt song.srt --vocals work/vocals_16k.wav --out aligned.json     # --mode global 可做整首一次性对齐
```

首次运行会自动下载 MMS_FA 模型（约 1.2 GB）和 Demucs 权重。`--mode global` 中偏离 SRT 起点超过 `--max-offset`（默认 0.8 秒）的行会自动改用逐句窗口对齐。
**注意**：对歌声的对齐分数普遍很低；合唱、喊唱的句子不可靠；结果只是初稿，请在编辑器里校正。

## 日本語

この 2 つのスクリプトは、エディタ用の**一文字ごとのタイミング**の下書きを作ります。`separate.py` が Demucs で曲・動画から歌声を分離し、`align.py` が torchaudio の MMS_FA で SRT の歌詞を歌声に一文字ずつ合わせて、アプリの「歌詞を追加…」→「SRT・LRC・JSON ファイルを読み込む…」で取り込める JSON を出力します。
日本語の行は pykakasi でふりがなを付け（漢字ブロックへのふりがな、送りがなによる位置合わせ、かな拍単位のアライメント）、中国語の行はピンイン経由で合わせ（ふりがなは付きません）、フランス語・英語・ロシア語などは単語単位です。言語は行ごとに自動判定されます。

```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128   # CUDA 版を推奨（pytorch.org でコマンドを選択）
pip install -r requirements.txt                                                    # ffmpeg が PATH にも必要
python separate.py --input song.mp4 --out-dir work
python align.py --srt song.srt --vocals work/vocals_16k.wav --out aligned.json     # --mode global で曲全体を一括アライメント
```

初回実行時に MMS_FA モデル（約 1.2 GB）と Demucs の重みが自動でダウンロードされます。`--mode global` では、最初の文字が SRT の開始から `--max-offset`（既定 0.8 秒）以上ずれた行は、行ごとのウィンドウ方式でやり直します。
**注意**：歌声に対するアライメントのスコアは全般に低く、コーラスや叫ぶ部分は信頼できません。結果はあくまで下書きなので、エディタで修正してください。
