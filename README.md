# Karaoke Lyrics Video Maker

**English** · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

A pure front-end karaoke lyric editor and renderer. Per-character wipe, furigana aligned above each kanji,
multi-row layouts with count-in dots, a timeline editor, and a draggable wipe cursor for retiming by eye.
Export a **transparent PNG sequence** that Premiere Pro and other editors import directly, or screen-record the preview.

No installation and no build step: open `index.html` in Chrome or Edge, or host the folder on any static server.

![Karaoke Lyrics Video Maker](assets/social-preview.svg)

**Try it online:** https://azusatsang.github.io/karaoke-lyrics-video-maker/

## Features

- Per-character wipe, with long notes sliding smoothly to the next character
- Furigana (ruby) written as `漢字{かんじ}`, centred over the kanji it belongs to; words and kana can carry a reading too: `KING{キング}`, `[New York]{ニューヨーク}`
- Timing by kana beat (mora) for characters that carry furigana
- Latin, Cyrillic and Greek lyrics are timed by syllable (split automatically, correctable per line); letters inside a syllable follow it proportionally
- Multi-row layout: lines take turns on alternating row slots, plus harmony rows that sing at the same time
- Automatic paragraphs and a three-dot count-in before each paragraph
- Line breaks inside a lyric line (`Shift+Enter` or `\n`): the rows form one block with one count-in, and the wipe continues from row to row
- Per-line style: each line can have its own position offset, font, size, colors, furigana and count-in settings (*This line's own style*); move a line by `Alt`+dragging it in the preview
- Timeline editor: move lines, retime single characters or syllables, set when a line appears and disappears
- Draggable wipe cursor in the preview: pause, then drag it to where the singer actually is
- Tap-to-time with `T` while the media plays
- Timing helpers: playback speed 0.5× / 0.75× / 1× / 1.25× (media keeps its pitch), loop the selected line, play from the line start, volume and mute
- Timeline with a fixed row-label gutter, a whole-song overview strip, zoom to fit / zoom to line, panning, a resizable height, hover highlights, and a tooltip showing the exact value while you drag
- Undo / redo (150 steps; the buttons tell you what will be undone), project files (`.kara.json`), and a browser autosave as a safety net, with a save-status indicator
- A welcome guide on the first visit, a help dialog listing every shortcut and mouse action (`?` or `F1`), and an empty-project screen with the same starting points
- Paste or type lyrics (one line per row, blank line = paragraph break, `漢字{かんじ}` furigana accepted); they are laid out and ready for tap-timing
- Import SRT, LRC (including enhanced per-character / per-syllable LRC), or a per-character aligned JSON (see [forced alignment](#optional-forced-alignment))
- Auto furigana: kuromoji adds readings above kanji in the browser (the dictionary is downloaded only when you ask for it, after a confirmation)
- Export: transparent PNG sequence (to a folder, or as ZIP download in any browser), single frame PNG, a clean "screen recording" view, and lyrics files (LRC / SRT / ASS karaoke)
- Interface language switcher (中文 / 日本語 / English)
- Time against a YouTube video instead of a local file: paste a link and the picture plays under the lyrics in the preview (needs an internet connection)
- Two sample projects built in (Japanese with furigana, French), with audio from the MV on YouTube

## Quick start

1. **Open the app.** Open `index.html` in Chrome or Edge (or visit your hosted copy). On your first visit a welcome guide offers to play the built-in sample, import lyrics, open a project or start empty; the sample is already loaded behind it. Reopen the guide any time from the **?** button.
2. **Load the audio or video** (*Load Media…* in the top bar → a local file or a YouTube video, or drag the file / a YouTube link into the window). Lyric times follow its playback time. A YouTube link is saved in the project; YouTube videos have no waveform, and the page must be opened over http(s) (YouTube can't be embedded from file://). For a video with several audio tracks (e.g. dubs), click *Player settings* in the top bar and pick the track from the YouTube player's ⚙ menu; the browser remembers it. If a project names a media file that is not loaded, a banner over the preview says so; without media, playback runs on a silent internal clock (shown as *Silent clock* next to the time).
3. **Add lyrics.** *Add lyrics…* → *Paste or type lyrics…* takes plain text, one line per row (see [Adding lyrics](#adding-lyrics)); *Import an SRT / LRC / JSON file…* takes an SRT or plain LRC file (each line's characters are spread evenly over its time; you retime afterwards), an enhanced LRC, or an aligned JSON from `tools/align`. The *Samples…* menu has two ready-made projects.
4. **Retime and lay out** (see the editing reference below).
5. **Save** with `Ctrl+S` to a `.kara.json` project file (lyrics, timing and style are stored in it). The browser also keeps an autosave, but only as a safety net (see [Saving](#saving)).
6. **Export** from the *Export* tab on the right: PNG sequence, or screen-recording mode.

## Editing reference

The interface can be switched between 中文, 日本語 and English; the names below follow the English interface.
Press `?` or `F1` (or the **?** button) in the app for the same tables. The keyboard table there is generated from the same list the key handler uses, so it is always up to date.

### Mouse

| Where | Action | Effect |
| --- | --- | --- |
| Preview | Click lyrics | Select that line |
| Preview | Drag the **wipe cursor** (vertical bar with a dot), tool *Drag: Retime* | Pause at a moment, drag the cursor to the character being sung right now: the nearest character or syllable (or kana beat) starts at the current time. Boundaries that get pushed along are marked orange while you drag; letters inside a syllable follow proportionally |
| Preview | Drag the wipe cursor, tool *Drag: Scrub* | Moves the playback position back and forth along this line |
| Preview | `Alt`+drag lyrics | Move that line on screen (its position offset in *This line's own style*). It snaps to its original place and to the center lines of the picture; hold `Shift` as well to move freely |
| Preview | Double-click lyrics | Jump to the start of that line |
| Preview | Right-click lyrics | Same menu as on the timeline (including *Reset position* when the line has been moved) |
| Timeline | Click / drag the ruler | Seek |
| Timeline | Drag the solid part of a block | Move the whole line; drag it up or down to another track to change its row |
| Timeline | Drag a small tick in the lower half of the selected block | Adjust the start of one character or syllable (yellow ticks: one kana beat). Right-click a syllable tick to split or merge syllables |
| Timeline | Drag the right edge of the solid block | Adjust the line's end time |
| Timeline | Drag the left / right thin edge of the pale window | When the line appears / disappears (orange = set by hand) |
| Timeline | Drag the left end of the selected line's count-in dots | This line's own count-in length (orange = set); its appear time moves earlier automatically. Double-click to reset it to automatic |
| Timeline | Double-click a block / a thin edge | Jump to the line start / reset the appear or disappear time to automatic |
| Timeline | Right-click a block or empty space | Paragraph break, count-in dots, row, harmony line, split, merge, *Even out letters within syllables*, delete / add line |
| Timeline | Wheel / `Ctrl`+wheel | Scroll / zoom |
| Timeline | Middle-drag, or drag empty space | Pan |
| Timeline | Hold `Shift` while dragging | Don't snap to the playhead (otherwise edits snap to it within 6 px) |
| Timeline | Click / drag the overview strip at the bottom | Jump to that part of the song |
| Timeline | Drag the divider above the timeline | Resize it (remembered) |
| Lyrics list | Click / double-click / right-click a line | Select / jump to its start / same menu as on the timeline |
| Anywhere | Drop files onto the window | Open a project, SRT or LRC, or load audio / video (several files are processed one after another) |

While you drag on the timeline or in the preview, a small tooltip shows the value being changed (time to the millisecond, the character, syllable or kana beat, the row).

### Keyboard

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `Enter` | Play the selected line from its start (1 s pre-roll) |
| `L` | Loop the selected line on / off (from 1 s before it to just after it; the loop follows the selection and is shown in green on the timeline) |
| `Home` | Jump to 1 s before the selected line |
| `←` `→` | Seek 1 s (`Shift`: 5 s) |
| `,` `.` | Step one frame |
| `Shift+,` `Shift+.` | Slower / faster (0.5× – 1.25×) |
| `↑` `↓` | Select previous / next line |
| `T` | Tap-to-time. While playing, each press sets the start time of the selected line's next character (syllable by syllable for Latin, Cyrillic and Greek text, kana beat by beat for characters with furigana); the final press ends the line and moves to the next one |
| `[` `]` | Shift the whole line by -20 ms / +20 ms (`Shift`: 100 ms) |
| `P` | Paragraph break here on / off |
| `D` | Cycle count-in dots (auto → show → hide) |
| `H` | Duplicate as a harmony line |
| `S` | Split the line at the playhead |
| `M` | Merge with the next line |
| `1`-`4` / `0` | Row 1-4 / automatic |
| `Delete` | Delete the line |
| `Ctrl`+`←` `→` `↑` `↓` | Move the selected line on screen by 4 px (`Ctrl+Shift`: 20 px) |
| `F` / `Shift+F` | Zoom the timeline to the selected line / to the whole song |
| `=` `-` | Zoom the timeline in / out |
| `?` / `F1` | Help |
| `Esc` | Close menu / leave Record Mode |
| `Ctrl+Z` / `Ctrl+Shift+Z` or `Ctrl+Y` | Undo / redo |
| `Ctrl+S` / `Ctrl+Shift+S` / `Ctrl+O` | Save / Save As / Open |

Shortcuts work whenever the cursor is not in a text field. A focused slider keeps the arrow keys for itself; drop-downs and sliders you used with the mouse give the keyboard back straight away.

### Playback tools

The bar under the preview has the play button, the time, the *Silent clock* badge (only without media), the playback speed, *Loop*, mute and volume (for loaded media), and the drag tool for the wipe cursor. The timeline has *Fit* (whole song), *Line* (selected line) and zoom buttons in its top-right corner.

## Adding lyrics

*Add lyrics…* in the top bar → *Paste or type lyrics…* (the welcome guide's *Paste lyrics* and the same button on the empty-project screen open it too) opens the *Add lyrics* dialog:

- Paste your lyrics into the large text box, **one line per row; a blank line starts a new paragraph** (the next line gets *Break here*). After a kanji word you can write `漢字{かんじ}` to add furigana. Below the box you see the number of lines, paragraphs and the approximate length.
- Inside a row, the two characters `\n` become a line break inside that lyric line (see *Line breaks inside a line* below).
- *Add*: *after the existing lyrics*, or *replace all lyrics (undoable)*.
- *Start at*: *the playhead*, *0:00*, or *after the last line* (only when adding after the existing lyrics).
- *Seconds per line* (default 3): the lines are laid out back to back and each line's characters are spread evenly over its time, like *Even split*. *Gap at paragraphs (s)* (default 4) is extra time left at blank lines, which leaves room for the count-in dots.
- After *Add lyrics* the first new line is selected and a message tells you to press Space and tap `T` on each character (or syllable) as you hear it. The whole operation is **one undo step**.

## Display rules

- **Paragraphs.** A gap of at least the *Auto break gap* (Layout tab) since the previous lyric starts a new paragraph; you can also force a break with *Start a new paragraph here* in the right-click menu. Within a paragraph, lines take turns on the row slots, and the next line appears once its slot is free. **Paragraphs never pre-show each other**: the next paragraph's lyrics do not appear before the last line of the previous one has been sung, and the new paragraph starts with count-in dots.
- **Count-in dots.** Three dots count down before the first line of each paragraph. Each line can be forced on or off. To give one line a longer or shorter count-in, select it and drag the left end of its dots on the timeline (or change *Countdown (s)* under *Count-in* in *This line's own style*); its appear time moves earlier automatically, as far as *Max pre-show (s)* and the end of the previous paragraph allow. The dots use the lyric fill colors unless you set *Dot colors (waiting / counting)* (Layout tab, or per line); ↺ next to the global setting makes them follow the lyric colors again. *Dot position* (Layout tab, or per line) puts the dots *Above the text* at the start of the line (default) or *Left of the text*, level with the lyrics and right before the first character.
- **Harmony / simultaneous rows.** *Duplicate as harmony line* places the copy on a free row slot (for example row 3), and every row wipes on its own timing at the same time. Row slot, alignment, and appear / disappear times can all be overridden per line.
- **Line breaks inside a line.** In the lyric field of the *Line* tab, `Shift+Enter` (the field is multi-line, so a plain `Enter` inserts a break too) or the two characters `\n` split a lyric line into several rows that form one block: they appear and disappear together, the count-in dots stand before the first row, and the wipe continues from the end of one row to the start of the next. Each row is aligned like the line, furigana sits above each row, and when the widest row is wider than *Max width* the whole block is scaled down. Rows are *Spacing of wrapped rows* apart (Layout tab, also per line); when a later row carries furigana, the furigana height is added so it does not touch the row above. Lines on a row slot in the upper half (or when there is only one slot) grow upward, so their last row sits on the slot's baseline; lines on the other slots grow downward. *Wrapped rows grow* in *This line's own style* overrides this (upward / downward / centered on the baseline). Overlaps with other slots are not resolved automatically: move the line with its position offset. A break never falls inside a syllable (a break in the middle of a word starts a new syllable), whitespace next to a break takes no room, and breaks are shown as ⏎ in the lyrics list and on the timeline. Splitting a line exactly at a break drops the break; merging never adds one.
- **This line's own style.** The collapsible *This line's own style* group in the *Line* tab overrides settings for the selected line only: *Position* (*Offset → (× width)* and *Offset ↓ (× height)*, stored as fractions of the canvas so they survive a change of canvas size, and *Wrapped rows grow*), *Text* (font, weight, size, letter spacing, max width, spacing of wrapped rows, outline width, glow), *Colors*, *Furigana* and *Count-in*. A field you have not changed shows the global value; a changed field is marked orange and its ↺ button goes back to the global setting. *Copy style* / *Paste style*, *Apply to paragraph* and *Apply to all lines* copy the style, but not the position, to other lines; *Reset this line to the global style* removes everything the line sets for itself. Each of these is one undo step. Lines with their own style are marked **Aa** in the lyrics list. The group opens by itself for such lines; when you open or close it by hand, that choice is remembered. *Duplicate as harmony line* and splitting copy a line's own style; merging keeps the first line's.
- **Furigana.** Write readings in the lyric text as `漢字{かんじ}`. When you edit the text, characters before and after the change keep their timing. This is not limited to kanji: `{…}` attaches to the kanji run, the word (letters and digits, including an inner `'` or `-`, as in `KING{キング}` or `Don't{ドント}`), the katakana or hiragana run, or the run of another script (such as Hangul) right before it. For any other span (several words, mixed scripts, symbols) put square brackets around it: `[New York]{ニューヨーク}`, `愛した[あなた]{きみ}`. A span with a reading is one unit and is timed by the beats of its reading (no longer by syllable); clearing its reading in the table on the right splits it back into single characters. *Auto furigana* only handles kanji, and readings you wrote on anything else are kept even with *Also replace existing furigana*.
- **Auto furigana.** Use *Furigana…* in the header of the lyrics list, *Auto furigana…* in the *Line* tab, or *Auto furigana (this line)…* / *Auto furigana (all lines)…* in the right-click menu. The dialog lets you pick *Only the selected line* or *All lyrics*, and whether to *Also replace existing furigana* (off by default: readings you already wrote and all timing stay). A run of kanji becomes one unit carrying its hiragana reading; for words that mix kanji and kana such as 受け入れ the reading is split by anchoring on the kana, so each kanji block gets only its own reading (受{う}け入{い}れ). The whole operation is one undo step and a message tells you how many readings were added. **Automatic readings are often wrong in lyrics** (names, archaic or special readings such as 征く, wrong word splits): proofread every line.
- **Timing by kana beat.** A character with furigana is split into the beats of its reading (small kana join the previous beat). The cursor, the yellow ticks on the timeline, tap-to-time and the table on the right can all adjust each beat; beats you have not touched are spread evenly inside the character. When a reading is written in letters (pinyin, romaji) or bopomofo, a run of them is one beat; separate beats with a space or `'`, `·`, `-`, and a bopomofo tone mark (ˊ ˇ ˋ) also ends a beat: `中国{zhōng guó}` and `中文{ㄓㄨㄥ ㄨㄣˊ}` are 2 beats each. As with syllable breaks in the lyric text, a `|` inside a reading also splits beats and is not shown: `漢字{ka|n|ji}` is 3 beats and is drawn as kanji.
- **Timing by syllable (Latin, Cyrillic, Greek).** In alphabetic text you time syllables, not letters: the wipe cursor snaps to syllable starts, the timeline shows one tick per syllable (a shorter tick inside a word), `T` taps one syllable per press, and the table in the *Line* tab has one row per syllable. Words are split automatically at vowel groups: one consonant between two vowel groups goes to the next syllable; of several consonants the last one does, except pairs that stay together (consonant + `l` / `r`, `ch`, `ph`, `th`, `sh`, `gn`, `qu`, …); a hyphen ends a syllable and an apostrophe stays with the letters before it; a word without a vowel is one syllable, and a run of digits is one group. For example *fon·tai·ne*, *Hy·dro*, *ко·ро·ле·ва*. It is only a first guess (silent letters, the French mute *e*, a syllable held over several notes): right-click a syllable tick on the timeline or a syllable row in the table (or use the row's **⋯** button) and choose *Split syllable here…* (then the letter), *Merge with previous syllable* or *Reset syllables to automatic*. Each is one undo step and is saved in the project. In the lyric text you can also type `|` between two letters, e.g. `Fon|taine`. When a syllable start moves, the letters inside the neighbouring syllables, and the spaces and punctuation after a word, are moved proportionally instead of piling up on one timestamp; syllables (or characters) pushed along by a drag keep at least 30 ms each while the line has room.
- **Repairing older projects.** Projects edited before syllable timing may have letters stacked on one timestamp, so the wipe jumps over them. *Even out letters within syllables* (*Line* tab, or the right-click menu, also as *Even out letters within syllables (all lines)*) spreads the letters of each syllable evenly between its start and the next syllable without moving syllable starts; syllables of a word that sit on the same instant are spread across the word first. It is one undo step. Opening a project never changes its timing by itself.
- **Wipe speed.** Each character is wiped from its own start until the next character starts (the last character until the line's end), so a long note slides across slowly. To make a long note stop and hold, drag the next character or the line end to where it really is.

## Exporting

**PNG sequence (transparent).** *Export* tab → choose frame rate (24 / 25 / 30 / 50 / 60), start and end seconds, and background (transparent or solid colour) → *Export PNG sequence to folder...* and pick an empty folder. Files are written as `lyrics_000001.png`, `lyrics_000002.png`, ... at the project resolution. *Save current frame* writes a single PNG. Folder export needs a Chromium-based browser (see [Browser support](#browser-support)).

**Export video (MP4).** *Export video (MP4)…* encodes straight to a single H.264 file (`<project title>_lyrics.mp4`) with the browser's own encoder (WebCodecs, hardware-accelerated where available; Chrome / Edge). It is by far the fastest and smallest export (a few MB where the PNG sequence takes hundreds), but **MP4 has no alpha channel**: with a transparent background the frame is filled with *Style → key color*, to be keyed out in your editor, exactly like a screen recording. There is no audio track. Use the PNG sequence when you need real transparency.

**Download as ZIP.** *Download as ZIP…* works in every browser (where there is no folder API it is the only way). The ZIP is store-only (PNGs are already compressed) and is built in the browser while the frames are rendered. **Long sequences are split into several ZIP files (up to 2000 frames each, e.g. `<project title>_lyrics_part01.zip`); frame numbers continue across the files, so unzip them all into the same folder.** Your browser may ask whether to allow multiple downloads. Because a ZIP is first assembled in the browser's memory / temporary storage, the export estimates the total size before it starts (frames × the PNG size of a sample frame) and **warns above roughly 1.5 GB**; lower the frame rate or shorten the range.

**Lyrics files.** The *Lyrics files* section of the *Export* tab. Times include the Layout tab's *Global offset*.

- *LRC (per character / syllable)*: enhanced LRC with a `<mm:ss.xx>` tag before every character (before every syllable in Latin, Cyrillic and Greek text; when imported, letters without their own tag are spread evenly between the tags), `[mm:ss.xx]` at the start of the line and a closing tag for the line's end. *LRC (per line)*: plain LRC with one timestamp per line. LRC has no multi-row lines, so a line break inside a line becomes a space.
- *SRT*: one cue per lyric line, from the line start to its end. A line break inside a line becomes a line break inside the cue, and importing an SRT turns a multi-line cue into one lyric line with breaks.
- *ASS karaoke*: one Dialogue per line with a `\kf<centiseconds>` wipe tag per character. The header has `[Script Info]` and `[V4+ Styles]`; the play resolution is the canvas size, the font is the first family name, and colors are converted to `&HBBGGRR` (unsung / swept = the two lyric fill colors, outline = the unsung outline color). On-screen position is approximated from row and alignment. Line breaks become `\N`; a line's own font, size, weight, colors, outline width and letter spacing are written as inline tags, and its position offset is folded into the margins (approximate; the growth direction of wrapped rows is not reproduced).
- Furigana cannot be represented in these formats and is left out; the ASS look is approximate, so check it in your player.

**Premiere Pro.** File → Import, select the first image, and tick **Image Sequence**. If you exported from 0 s, place the clip at 0 s on the timeline and it lines up with the audio.

**Single ProRes 4444 file with alpha** (match `-framerate` to the frame rate you exported):

```bash
ffmpeg -framerate 60 -i lyrics_%06d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le lyrics.mov
```

**Record Mode.** The *Record Mode* button in the top bar hides every panel and shows only the picture; press `Esc` to leave. With a transparent background, fill it with the key colour (*Style* tab) and remove that colour in your editor.

## Saving

- `Ctrl+S` writes the `.kara.json` file you opened or saved last (in Chrome / Edge); in other browsers *Save* downloads a copy instead.
- The indicator next to the project name tells you where your work is: *Sample (unchanged)*, *Saved: ‹file›*, *Unsaved changes* (the file is older than what you see), or *Autosaved in this browser only* (nothing has been written to a file yet). Click it to save.
- The browser autosave is restored when you come back, together with that status. If you try to leave the page while there are changes that are not in a file, the browser asks you to confirm; an untouched sample never triggers this.
- Replacing the project (New, a sample, opening or importing a file) asks first when there are unsaved changes.
- Interface preferences (tool, timeline zoom and height, playback speed, volume, open tab, language) are remembered separately from the project.

## Optional: forced alignment

A browser cannot do forced alignment, so `tools/align` provides Python scripts that turn an SRT with only one start and end per line into a **per-character timing draft**, which you then correct in the editor. Both built-in samples were made this way. Installation and every option are in [tools/align/README.md](tools/align/README.md).

### How the draft is generated

1. **Prepare an SRT**: one cue per lyric line, with roughly correct times. In Japanese lines, write `漢字（カタカナ）` to force a reading.
2. **Separate the vocals**: `python separate.py --input song.mp4 --out-dir work`. Demucs (`htdemucs`) isolates the vocals from the **final audio** and writes `vocals_16k.wav`. Use the same version of the audio as the finished video, not stems from another version, or every time will be offset.
3. **Split and read the text**: `align.py` detects the language of each line and splits it into the units to align:
   - Japanese: readings from pykakasi; kanji blocks get furigana, okurigana anchors where a reading ends, and timing is per mora;
   - Chinese: aligned through pinyin, no furigana;
   - French, English, Russian and similar: accents stripped (Cyrillic transliterated), aligned per word, and the letters of a word share its time evenly.
4. **Align**: `python align.py --srt song.srt --vocals work/vocals_16k.wav --out aligned.json`. The torchaudio MMS_FA model places those units on the vocals, in one of two modes:
   - `--mode window` (default): each line is searched only within `--pad` seconds of its SRT time; use it when the SRT times are already close;
   - `--mode global`: the whole song in one pass, which tolerates rough SRT times; a line whose start lands more than `--max-offset` seconds from its SRT start is redone in window mode.

   Lines that cannot be aligned are split evenly over their SRT time and listed in the summary printed at the end.
5. **Import**: in the app, *Load Media…* (the same song), then *Add lyrics…* → *Import an SRT / LRC / JSON file…* and choose `aligned.json`.
6. **Correct**: start with the low-score and evenly split lines from the summary. Play and fix: drag the wipe cursor in the preview, drag the ticks on the timeline, or tap `T` again. Latin text is aligned per word, so syllable positions are yours to set; *Even out letters within syllables* repairs a word whose letters have bunched up. Fix wrong furigana in the lyric text field.

For the built-in samples: the Japanese one used the default window mode; the French one (with Japanese, Russian, English and Chinese lines) had rougher SRT times and used global mode, with 3 lines falling back to window mode. Alignment scores on singing are low throughout (the medians for the two samples were about 0.29 and 0.08), and chorus or shouted lines are the least reliable, so this is a draft that saves you tapping everything from scratch, nothing more.

You can skip all of this: pasted lyrics and plain SRT imports get evenly split times that you tap in with `T`, and *Auto furigana…* adds Japanese readings.

## Browser support

| Browser | Status |
| --- | --- |
| Chrome / Edge (desktop) | Fully supported |
| Others (Firefox, Safari) | Not tested. **PNG sequence export to a folder** needs the File System Access API and **listing local fonts** needs the Local Font Access API; both are only available in Chromium-based browsers (*Download as ZIP…* works without the folder API). Without the font API you can still type a font name in the CSS font-family field or load a font file |

## Privacy

Everything runs locally in your browser. Your audio / video, lyrics and projects are never uploaded anywhere, and the app has no backend. It contacts the network in only two cases. The first is *Auto furigana*: only after you use it for the first time and confirm the dialog are the kuromoji script and an about 18 MB Japanese dictionary downloaded from jsDelivr (`cdn.jsdelivr.net`). Your lyrics are still processed locally and never uploaded. So this feature needs an internet connection and access to jsDelivr; offline or when blocked it reports the failure and your lyrics stay untouched. The second is **YouTube**: when a project uses a YouTube video, the YouTube player is loaded from `youtube.com` / `youtube-nocookie.com` and YouTube sees that you are watching that video. The built-in samples use one, so this also happens on your first visit to a hosted copy; it does not happen when you open `index.html` straight from disk (`file://`), where YouTube cannot be embedded, or in a project without a YouTube link. The autosave and your interface preferences are kept in your browser's `localStorage` (clearing site data removes them). Save a `.kara.json` file if you want to keep your work.

## Known limitations

- Audio / video and loaded font files are not stored in the project; load them again after reopening.
- Exporting to a folder and listing local fonts require Chrome or Edge. Other browsers can export the PNG sequence with *Download as ZIP…*, but a ZIP is assembled in memory, so for very long sequences lower the frame rate or export in ranges.
- Auto furigana needs an internet connection to download its dictionary (from jsDelivr) and is often wrong, so it always needs proofreading. LRC / SRT / ASS export does not include furigana.
- Waveforms are not generated for media larger than 400 MB (sync is unaffected).
- The editor is designed for a desktop browser with a mouse and keyboard. Below about 1100 px wide the side panels get narrower and can be hidden with the ☰ / ⚙ buttons; on phone-sized screens the panels are stacked and a dismissible note says the editor is meant for desktop.
- Forced alignment is not available in the browser; it needs the optional Python tools and gives rough results on singing.

## Deploying to GitHub Pages

The app is plain static files, so no build is needed.

1. Push this repository to GitHub.
2. Open **Settings → Pages**.
3. Under *Build and deployment*, set **Source** to *Deploy from a branch*, choose your default branch and the **/ (root)** folder, then save.
4. After a minute your site is available at `https://<your-github-username>.github.io/<repository-name>/`.

The empty `.nojekyll` file makes GitHub Pages serve every file as-is.

Before publishing, fill in two placeholders:

- the repository link shown in *Help → About*: `K.APP.repo` at the top of `js/app.js` (the only place it is defined);
- the social-preview image in the `<head>` of `index.html` (`og:image`, `twitter:image`): link crawlers need an absolute URL, so replace `assets/social-preview.png` with the full address of your deployment. The same PNG can be uploaded as the repository's social preview under **Settings → General**.

## Running the smoke test

```bash
bash tests/run.sh
```

It opens the app in headless Chrome, simulates interactions (first-run welcome, dragging the wipe cursor and timeline handles, every keyboard shortcut against the help table, speed and loop, the in-app dialogs, file drops, language switching, malicious project files, pasting lyrics, syllable timing, LRC import and export round trips, SRT / ASS export, auto furigana with a stubbed tokenizer, the ZIP writer, …) and prints `PASS: <n> checks`, or `FAIL: …` followed by the failed checks as JSON; the exit code is non-zero on failure. Set `VERBOSE=1` to see the details of a passing run too. The test runs under Chrome's virtual-time budget (default 300000 ms, override with the `BUDGET` environment variable), and the auto-furigana tests **do not touch the network**. The script looks for Chrome at the default Windows path; set the `CHROME` environment variable to point at another Chrome / Chromium binary (for example on Linux or macOS).

## Third-party / content notice

- The bundled sample lyrics in `samples/` are the author's own demo data for a fan song. They come without a warranty of any kind.
- **Auto furigana** is loaded at run time from the jsDelivr CDN and is **not bundled** in this repository: [kuromoji.js](https://github.com/takuyaa/kuromoji.js) (Apache License 2.0, © Takuya Asano, Atilika Inc.) and its dictionary, which is derived from mecab-ipadic-2.7.0-20070801 (© 2000-2003 Nara Institute of Science and Technology; use, reproduction and distribution are permitted provided that every copy carries its copyright notice and disclaimer, see `NOTICE.md` in the kuromoji package).
- The sample projects reference a font named `SDK_JP_Web-Heavy`, which is **not** bundled. Without it installed, the text falls back to system fonts.

## License

[MIT](LICENSE) © 2026 Tsang
