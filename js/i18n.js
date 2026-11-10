/* 界面多语言：K.t(key, {参数}) / K.lang / K.setLang(code)；切换时 K.emit('lang')
   语言选择优先级：?lang= > localStorage > navigator.languages。工程数据与语言无关。
   约定：key 以 _html 结尾的文案含少量固定标记（只来自本文件，可直接放进 innerHTML，参数须先转义）。 */
(function () {
  const K = window.K;
  const D = {};

  D['zh-CN'] = {
    'app.name': '卡拉OK歌词工作室',
    'untitled': '未命名',
    'newLyric': '新歌词',
    'projType': '卡拉OK工程',
    'sample.hydro_king_jp': 'HYDRO KING（日语，带注音）',
    'sample.hydro_king_fr': 'HYDRO KING（法语多语言）',

    'top.title': '工程名称',
    'top.new': '新建', 'top.newTip': '新建空工程（保留当前样式）',
    'top.open': '打开…', 'top.openTip': '打开工程文件 Ctrl+O',
    'top.save': '保存', 'top.saveTip': '保存到工程文件 Ctrl+S',
    'top.saveAs': '另存为…', 'top.saveAsTip': '另存为 Ctrl+Shift+S',
    'top.import': '导入 SRT / JSON…', 'top.importTip': '导入 SRT 字幕，或对齐脚本输出的 JSON',
    'top.samples': '示例…', 'top.samplesTip': '载入内置示例',
    'top.media': '载入音视频…', 'top.mediaTip': '载入用于同步的音频或视频（也可直接把文件拖进窗口）',
    'top.noMedia': '未载入音视频',
    'top.undo': '↶ 撤销', 'top.undoTip': '撤销 Ctrl+Z',
    'top.redo': '↷ 重做', 'top.redoTip': '重做 Ctrl+Y',
    'top.rec': '录屏模式', 'top.recTip': '隐藏界面只显示画面，用于录屏；Esc 退出',
    'top.langTip': '界面语言 / Language',

    'left.title': '歌词行', 'left.add': '＋ 添加', 'left.addTip': '在播放头处添加一行',
    'list.empty': '还没有歌词。用上方「导入」载入 SRT，或在时间线空白处右键添加。',
    'list.rowAuto': '行位（自动）', 'list.rowManual': '行位（手动）',

    'bar.playTip': '播放 / 暂停（空格）',
    'bar.toolTip': '拖动预览里的擦除光标时做什么',
    'bar.retime': '拖光标：校时', 'bar.retimeTip': '暂停在某一刻，把光标拖到此刻实际唱到的字上 → 该字的开始时间 = 当前时间',
    'bar.scrub': '拖光标：浏览', 'bar.scrubTip': '拖动光标 = 沿着这句歌词前后浏览时间',
    'bar.hint': '空格 播放 · T 打点 · ↑↓ 选行 · P 分段 · D 预备点 · H 和声行 · 1-4 行位 · [ ] 微移',
    'bar.zoomOut': '时间线缩小（Ctrl+滚轮）', 'bar.zoomIn': '时间线放大（Ctrl+滚轮）',

    'tab.line': '行', 'tab.style': '样式', 'tab.layout': '版面', 'tab.export': '导出',

    'exp.png': 'PNG 序列（带透明通道）', 'exp.fps': '帧率', 'exp.range': '起止(s)', 'exp.start': '开始时间（秒）', 'exp.end': '结束时间（秒）',
    'exp.bg': '背景', 'exp.bgNone': '透明', 'exp.bgColor': '纯色背景',
    'exp.go': '导出 PNG 序列到文件夹…', 'exp.frame': '保存当前帧', 'exp.cancel': '取消',
    'exp.premiere': 'Premiere：文件 → 导入，选第一张并勾选「图像序列」。从 0 秒导出时，放在时间线 0 秒处即对齐。',
    'exp.prores': '转成单个 ProRes 4444：',
    'exp.rec': '录屏', 'exp.recHint': '顶部「录屏模式」会隐藏全部界面；透明背景时用「样式 → 抠像色」铺底，录完在剪辑软件里抠掉。',
    'exp.needChrome': '导出到文件夹需要 Chrome / Edge',
    'exp.cancelled': '已取消，已写入 {n} 帧',
    'exp.progress': '导出中 {i}/{n}（{s}s）',
    'exp.done': '完成：{n} 帧，{w}×{h} @ {fps}fps，从 {t0}s 开始',
    'exp.failed': '导出失败：{msg}',

    'menu.paraOn': '✓ 新段落从这里开始', 'menu.paraSet': '在此分段（下一段另起，不提前显示）', 'menu.paraAuto': '分段恢复自动',
    'menu.dotsAuto': '预备点：自动', 'menu.dotsOn': '预备点：显示', 'menu.dotsOff': '预备点：不显示',
    'menu.rowAuto': '行位：自动', 'menu.row': '行位：第 {n} 行',
    'menu.dup': '复制为和声行（同时显示、同时擦除）', 'menu.split': '在播放头处拆分', 'menu.merge': '与下一行合并',
    'menu.resetShow': '显示 / 消失时间恢复自动', 'menu.del': '删除这一行', 'menu.add': '在此处添加歌词行',

    'line.help_html': '在预览、时间线或左侧列表里点选一行歌词。<br><br>· 预览里拖动<b>擦除光标</b>（竖线+圆点）可直接校时<br>· 时间线里拖动块 = 整行平移；拖下半部的小竖线 = 调单个字<br>· 拖块两侧的细边 = 这一行何时出现 / 消失<br>· 右键块 = 分段、预备点、和声行、拆分合并',
    'line.text': '歌词（注音写法：漢字{かんじ}）',
    'line.startEnd': '开始 / 结束', 'line.rowAlign': '行位 / 对齐',
    'line.rowAutoN': '自动（第{n}行）', 'line.rowN': '第 {n} 行',
    'line.alignAuto': '自动', 'line.left': '靠左', 'line.center': '居中', 'line.right': '靠右',
    'line.para': '分段', 'line.paraAutoY': '自动（是）', 'line.paraAutoN': '自动（否）', 'line.paraOn': '在此分段', 'line.paraOff': '不分段',
    'line.dots': '预备点', 'line.dotsAutoY': '自动（有）', 'line.dotsAutoN': '自动（无）', 'line.dotsOn': '显示', 'line.dotsOff': '不显示',
    'line.show': '出现时间', 'line.hide': '消失时间', 'line.auto': '自动', 'line.resetAuto': '恢复自动',
    'line.even': '逐字等分', 'line.dup': '复制为和声行', 'line.split': '播放头处拆分', 'line.merge': '合并下一行', 'line.del': '删除',
    'line.tap_html': '打点校时：播放时按 <kbd>T</kbd>，每按一次给下一个字打上开始时间，带注音的字按假名一拍一拍打（当前第 {cur} / {total} 拍，最后再按一次 = 行结束并跳到下一行）。',
    'line.thChar': '字', 'line.thRuby': '注音', 'line.thStart': '开始(s)',
    'line.atTip': '把这个字的开始设为当前播放时间', 'line.atMoraTip': '把这一拍的开始设为当前播放时间',

    'f.font': '字体', 'f.fontCss': '字体族(CSS)', 'f.sysFonts': '读取本机全部字体', 'f.fontFile': '载入字体文件…',
    'f.weight': '字重', 'f.wNormal': '常规', 'f.wBold': '粗体', 'f.wBlack': '特粗',
    'f.size': '字号', 'f.rubyRatio': '注音比例', 'f.rubyGap': '注音间距', 'f.spacing': '字间距',
    'f.colors': '颜色（未唱 / 已唱）', 'f.fill': '歌词填充', 'f.stroke': '歌词描边', 'f.rubyFill': '注音填充', 'f.rubyStroke': '注音描边',
    'f.strokeW': '描边粗细', 'f.rubyStrokeW': '注音描边粗细', 'f.glowColor': '辉光', 'f.glow': '辉光强度',
    'f.bg': '背景', 'f.bgMode': '模式', 'f.bgNone': '透明（棋盘格）', 'f.bgColor': '纯色', 'f.bgColors': '纯色 / 抠像色',
    'f.videoBg': '视频作背景', 'f.videoBgHint': '仅预览 / 录屏',
    'f.canvas': '画面', 'f.size2': '画布 W×H', 'f.layout': '多行版式', 'f.duet': '左右交错（1左 2右 3中）', 'f.stack': '全部居中',
    'f.rows': '自动行数', 'f.rowsOne': '{n} 行', 'f.rowsN': '{n} 行',
    'f.posY': '第 1 行基线', 'f.lineGap': '行距', 'f.marginX': '左右边距', 'f.maxW': '最大宽度',
    'f.showHide': '出现与消失', 'f.preShow': '最早提前显示(s)', 'f.lead': '最少提前(s)', 'f.hold': '唱完保留(s)', 'f.fade': '淡入 / 淡出(s)',
    'f.paraDots': '段落与预备点', 'f.paraGap': '自动分段间隔(s)', 'f.dots': '预备点', 'f.dotsHint': '每段开头倒数三个点',
    'f.dotsDur': '倒数时长(s)', 'f.dotSize': '圆点大小', 'f.sync': '同步', 'f.offset': '整体偏移(s)',
    'f.current': '{name}（当前）', 'f.grpLoaded': '已载入的字体文件', 'f.grpCommon': '常用', 'f.grpLocal': '本机全部字体',
    'f.localOk': '已读取 {n} 个本机字体，在「字体」下拉里选',
    'f.localDenied': '读取本机字体被拒绝（可在地址栏左侧的网站设置里重新允许）',
    'f.localNA': '当前浏览器不支持读取本机字体，可在「字体族(CSS)」里直接输入字体名，或载入字体文件',
    'f.fileLoaded': '已载入字体「{name}」（字体文件不会存进工程，下次需重新载入或安装到系统）',

    'tl.row': '行{n}',

    'msg.bigMedia': '文件较大，不生成波形（不影响同步）',
    'msg.noWave': '无法解码音频波形（不影响同步）',
    'msg.saved': '已保存到 {name}', 'msg.saveFail': '保存失败：{msg}',
    'msg.srt': '已导入 SRT：每句的字按时长平均分配，可用打点 (T) 或拖动光标校时',
    'msg.readFail': '无法读取：{msg}',
    'msg.confirmSample': '载入示例会替换当前工程（未保存的修改会丢失），继续？',
    'msg.confirmNew': '新建会清空当前工程（未保存的修改会丢失），继续？',
  };

  D.ja = {
    'app.name': 'カラオケ歌詞スタジオ',
    'untitled': '無題',
    'newLyric': '新しい歌詞',
    'projType': 'カラオケプロジェクト',
    'sample.hydro_king_jp': 'HYDRO KING（日本語・ルビ付き）',
    'sample.hydro_king_fr': 'HYDRO KING（フランス語・多言語）',

    'top.title': 'プロジェクト名',
    'top.new': '新規', 'top.newTip': '空のプロジェクトを作成（現在のスタイルは引き継ぎます）',
    'top.open': '開く…', 'top.openTip': 'プロジェクトファイルを開く（Ctrl+O）',
    'top.save': '保存', 'top.saveTip': 'プロジェクトファイルに保存（Ctrl+S）',
    'top.saveAs': '別名保存…', 'top.saveAsTip': '名前を付けて保存（Ctrl+Shift+S）',
    'top.import': 'SRT・JSON 読込…', 'top.importTip': 'SRT 字幕、またはアライメントスクリプトが出力した JSON を読み込む',
    'top.samples': 'サンプル…', 'top.samplesTip': '内蔵サンプルを読み込む',
    'top.media': '音声・動画…', 'top.mediaTip': '同期に使う音声・動画を読み込む（ウィンドウへのドラッグ＆ドロップでも可）',
    'top.noMedia': '音声・動画なし',
    'top.undo': '↶ 元に戻す', 'top.undoTip': '元に戻す（Ctrl+Z）',
    'top.redo': '↷ やり直し', 'top.redoTip': 'やり直し（Ctrl+Y）',
    'top.rec': '録画モード', 'top.recTip': 'UI を隠して映像だけを表示（画面録画用）。Esc で終了',
    'top.langTip': '表示言語 / Language',

    'left.title': '歌詞', 'left.add': '＋ 追加', 'left.addTip': '再生位置に行を追加',
    'list.empty': 'まだ歌詞がありません。上の「SRT・JSON 読込」で SRT を読み込むか、タイムラインの空いている所を右クリックして追加してください。',
    'list.rowAuto': '段（自動）', 'list.rowManual': '段（手動）',

    'bar.playTip': '再生 / 一時停止（Space）',
    'bar.toolTip': 'プレビューのワイプカーソルをドラッグしたときの動作',
    'bar.retime': 'ドラッグ：タイミング', 'bar.retimeTip': '一時停止した瞬間に実際に歌っている文字までカーソルをドラッグ → その文字の開始時刻 = 現在時刻',
    'bar.scrub': 'ドラッグ：シーク', 'bar.scrubTip': 'カーソルをドラッグして、この行に沿って再生位置を前後に動かす',
    'bar.hint': 'Space 再生 · T タップ · ↑↓ 行選択 · P 段落 · D カウントイン · H ハモリ行 · 1-4 段 · [ ] 微調整',
    'bar.zoomOut': 'タイムラインを縮小（Ctrl+ホイール）', 'bar.zoomIn': 'タイムラインを拡大（Ctrl+ホイール）',

    'tab.line': '行', 'tab.style': 'スタイル', 'tab.layout': 'レイアウト', 'tab.export': '書き出し',

    'exp.png': 'PNG 連番（アルファ付き）', 'exp.fps': 'フレームレート', 'exp.range': '範囲 (秒)', 'exp.start': '開始（秒）', 'exp.end': '終了（秒）',
    'exp.bg': '背景', 'exp.bgNone': '透明', 'exp.bgColor': '単色',
    'exp.go': 'PNG 連番をフォルダーに書き出す…', 'exp.frame': '現在のフレームを保存', 'exp.cancel': 'キャンセル',
    'exp.premiere': 'Premiere：ファイル → 読み込み で 1 枚目を選び、「画像シーケンス」にチェック。0 秒から書き出した場合は、タイムラインの 0 秒に置けばそのまま合います。',
    'exp.prores': '1 本の ProRes 4444 に変換：',
    'exp.rec': '画面録画', 'exp.recHint': '上部の「録画モード」で UI がすべて隠れます。透明背景のときは「スタイル → キー色」で塗りつぶされるので、録画後に編集ソフトでキーアウトしてください。',
    'exp.needChrome': 'フォルダーへの書き出しには Chrome / Edge が必要です',
    'exp.cancelled': 'キャンセルしました（{n} フレーム書き出し済み）',
    'exp.progress': '書き出し中 {i}/{n}（{s} 秒）',
    'exp.done': '完了：{n} フレーム、{w}×{h} @ {fps}fps、{t0} 秒から',
    'exp.failed': '書き出しに失敗しました：{msg}',

    'menu.paraOn': '✓ ここから新しい段落', 'menu.paraSet': 'ここで段落を分ける（次の段落は先に表示しない）', 'menu.paraAuto': '段落分けを自動に戻す',
    'menu.dotsAuto': 'カウントイン：自動', 'menu.dotsOn': 'カウントイン：表示', 'menu.dotsOff': 'カウントイン：非表示',
    'menu.rowAuto': '段：自動', 'menu.row': '段：{n} 段目',
    'menu.dup': 'ハモリ行として複製（同時に表示・同時にワイプ）', 'menu.split': '再生位置で分割', 'menu.merge': '次の行と結合',
    'menu.resetShow': '表示・消去タイミングを自動に戻す', 'menu.del': 'この行を削除', 'menu.add': 'ここに歌詞の行を追加',

    'line.help_html': 'プレビュー、タイムライン、または左のリストで歌詞の行をクリックして選択します。<br><br>· プレビューで<b>ワイプカーソル</b>（縦線＋丸）をドラッグすると、その場でタイミングを調整<br>· タイムラインでブロックをドラッグ = 行全体を移動、下半分の短い縦線 = 1 文字ずつ調整<br>· ブロック両端の細い縁 = その行を表示 / 消去するタイミング<br>· ブロックを右クリック = 段落、カウントイン、ハモリ行、分割・結合',
    'line.text': '歌詞（ルビの書き方：漢字{かんじ}）',
    'line.startEnd': '開始 / 終了', 'line.rowAlign': '段 / 揃え',
    'line.rowAutoN': '自動（{n}）', 'line.rowN': '{n} 段目',
    'line.alignAuto': '自動', 'line.left': '左揃え', 'line.center': '中央', 'line.right': '右揃え',
    'line.para': '段落', 'line.paraAutoY': '自動（区切る）', 'line.paraAutoN': '自動（区切らない）', 'line.paraOn': 'ここで区切る', 'line.paraOff': '区切らない',
    'line.dots': 'カウントイン', 'line.dotsAutoY': '自動（あり）', 'line.dotsAutoN': '自動（なし）', 'line.dotsOn': '表示', 'line.dotsOff': '非表示',
    'line.show': '表示開始', 'line.hide': '表示終了', 'line.auto': '自動', 'line.resetAuto': '自動に戻す',
    'line.even': '均等割り', 'line.dup': 'ハモリ行に複製', 'line.split': '再生位置で分割', 'line.merge': '次の行と結合', 'line.del': '削除',
    'line.tap_html': 'タップでタイミング：再生中に <kbd>T</kbd> を押すたびに次の文字の開始時刻を記録します。ルビ付きの文字は仮名 1 拍ずつ（現在 {cur} / {total} 拍目。最後にもう一度押すと行の終わりになり、次の行へ進みます）。',
    'line.thChar': '字', 'line.thRuby': 'ルビ', 'line.thStart': '開始 (秒)',
    'line.atTip': 'この文字の開始を現在の再生位置にする', 'line.atMoraTip': 'この拍の開始を現在の再生位置にする',

    'f.font': 'フォント', 'f.fontCss': 'フォント (CSS)', 'f.sysFonts': 'PC のフォントを読み込む', 'f.fontFile': 'フォントファイル…',
    'f.weight': '太さ', 'f.wNormal': '標準', 'f.wBold': '太字', 'f.wBlack': '極太',
    'f.size': 'サイズ', 'f.rubyRatio': 'ルビの比率', 'f.rubyGap': 'ルビの間隔', 'f.spacing': '字間',
    'f.colors': '色（歌う前 / 歌った後）', 'f.fill': '歌詞の塗り', 'f.stroke': '歌詞の縁', 'f.rubyFill': 'ルビの塗り', 'f.rubyStroke': 'ルビの縁',
    'f.strokeW': '縁の太さ', 'f.rubyStrokeW': 'ルビの縁の太さ', 'f.glowColor': 'グロー', 'f.glow': 'グローの強さ',
    'f.bg': '背景', 'f.bgMode': 'モード', 'f.bgNone': '透明（市松模様）', 'f.bgColor': '単色', 'f.bgColors': '単色 / キー色',
    'f.videoBg': '動画を背景に', 'f.videoBgHint': 'プレビュー・録画のみ',
    'f.canvas': '画面', 'f.size2': 'キャンバス W×H', 'f.layout': '段の配置', 'f.duet': '左右交互（左・右・中央）', 'f.stack': 'すべて中央',
    'f.rows': '自動の段数', 'f.rowsOne': '{n} 段', 'f.rowsN': '{n} 段',
    'f.posY': '1 段目の基線', 'f.lineGap': '段の間隔', 'f.marginX': '左右の余白', 'f.maxW': '最大幅',
    'f.showHide': '表示と消去', 'f.preShow': '最大先出し (秒)', 'f.lead': '最小先出し (秒)', 'f.hold': '歌唱後の保持 (秒)', 'f.fade': 'フェード入/出 (秒)',
    'f.paraDots': '段落とカウントイン', 'f.paraGap': '自動段落の間隔 (秒)', 'f.dots': 'カウントイン', 'f.dotsHint': '段落の頭に 3 点でカウント',
    'f.dotsDur': 'カウント長 (秒)', 'f.dotSize': '点のサイズ', 'f.sync': '同期', 'f.offset': '全体オフセット (秒)',
    'f.current': '{name}（現在）', 'f.grpLoaded': '読み込んだフォントファイル', 'f.grpCommon': 'よく使うフォント', 'f.grpLocal': 'この PC のフォント',
    'f.localOk': '{n} 個のフォントを読み込みました。「フォント」の一覧から選べます',
    'f.localDenied': 'フォントへのアクセスが拒否されました（アドレスバー左のサイト設定から再度許可できます）',
    'f.localNA': 'このブラウザーは PC のフォント一覧の取得に対応していません。「フォント (CSS)」に直接入力するか、フォントファイルを読み込んでください',
    'f.fileLoaded': 'フォント「{name}」を読み込みました（フォントファイルはプロジェクトに保存されません。次回も読み込み直すか、システムにインストールしてください）',

    'tl.row': '{n} 段',

    'msg.bigMedia': 'ファイルが大きいため波形は作成しません（同期には影響しません）',
    'msg.noWave': '音声の波形を解析できませんでした（同期には影響しません）',
    'msg.saved': '{name} に保存しました', 'msg.saveFail': '保存に失敗しました：{msg}',
    'msg.srt': 'SRT を読み込みました。各行の文字は時間で均等割りしています。タップ (T) やカーソルのドラッグでタイミングを合わせてください',
    'msg.readFail': '読み込めません：{msg}',
    'msg.confirmSample': 'サンプルを読み込むと現在のプロジェクトが置き換わります（未保存の変更は失われます）。続けますか？',
    'msg.confirmNew': '新規作成すると現在のプロジェクトは消去されます（未保存の変更は失われます）。続けますか？',
  };

  D.en = {
    'app.name': 'Karaoke Lyrics Studio',
    'untitled': 'Untitled',
    'newLyric': 'New lyric',
    'projType': 'Karaoke project',
    'sample.hydro_king_jp': 'HYDRO KING (Japanese, furigana)',
    'sample.hydro_king_fr': 'HYDRO KING (French, multilingual)',

    'top.title': 'Project name',
    'top.new': 'New', 'top.newTip': 'New empty project (keeps the current style)',
    'top.open': 'Open…', 'top.openTip': 'Open a project file (Ctrl+O)',
    'top.save': 'Save', 'top.saveTip': 'Save to the project file (Ctrl+S)',
    'top.saveAs': 'Save As…', 'top.saveAsTip': 'Save As (Ctrl+Shift+S)',
    'top.import': 'Import…', 'top.importTip': 'Import SRT subtitles, or JSON from the alignment script',
    'top.samples': 'Samples…', 'top.samplesTip': 'Load a built-in sample',
    'top.media': 'Load Media…', 'top.mediaTip': 'Load the audio or video to sync against (or drop a file onto the window)',
    'top.noMedia': 'No media loaded',
    'top.undo': '↶ Undo', 'top.undoTip': 'Undo (Ctrl+Z)',
    'top.redo': '↷ Redo', 'top.redoTip': 'Redo (Ctrl+Y)',
    'top.rec': 'Record Mode', 'top.recTip': 'Hide the UI and show only the picture, for screen recording. Esc to exit',
    'top.langTip': 'Interface language',

    'left.title': 'Lyrics', 'left.add': '+ Add', 'left.addTip': 'Add a line at the playhead',
    'list.empty': 'No lyrics yet. Use Import above to load an SRT file, or right-click an empty spot on the timeline to add a line.',
    'list.rowAuto': 'Row (auto)', 'list.rowManual': 'Row (manual)',

    'bar.playTip': 'Play / Pause (Space)',
    'bar.toolTip': 'What dragging the wipe cursor in the preview does',
    'bar.retime': 'Drag: Retime', 'bar.retimeTip': 'Pause, then drag the cursor to the character actually being sung at that moment → its start time becomes the current time',
    'bar.scrub': 'Drag: Scrub', 'bar.scrubTip': 'Drag the cursor to scrub back and forth along this line',
    'bar.hint': 'Space play · T tap · ↑↓ select · P paragraph · D count-in · H harmony · 1-4 row · [ ] nudge',
    'bar.zoomOut': 'Zoom timeline out (Ctrl+wheel)', 'bar.zoomIn': 'Zoom timeline in (Ctrl+wheel)',

    'tab.line': 'Line', 'tab.style': 'Style', 'tab.layout': 'Layout', 'tab.export': 'Export',

    'exp.png': 'PNG sequence (with alpha)', 'exp.fps': 'Frame rate', 'exp.range': 'Range (s)', 'exp.start': 'Start (seconds)', 'exp.end': 'End (seconds)',
    'exp.bg': 'Background', 'exp.bgNone': 'Transparent', 'exp.bgColor': 'Solid color',
    'exp.go': 'Export PNG sequence to folder…', 'exp.frame': 'Save current frame', 'exp.cancel': 'Cancel',
    'exp.premiere': 'Premiere: File → Import, select the first image and tick “Image Sequence”. If you exported from 0 s, drop it at 0 s on the timeline and it lines up.',
    'exp.prores': 'Convert to a single ProRes 4444 file:',
    'exp.rec': 'Screen recording', 'exp.recHint': 'Record Mode (top bar) hides the whole UI. With a transparent background the frame is filled with Style → key color; key it out in your editor afterwards.',
    'exp.needChrome': 'Exporting to a folder requires Chrome or Edge',
    'exp.cancelled': 'Cancelled after writing {n} frames',
    'exp.progress': 'Exporting {i}/{n} ({s}s)',
    'exp.done': 'Done: {n} frames, {w}×{h} @ {fps} fps, starting at {t0}s',
    'exp.failed': 'Export failed: {msg}',

    'menu.paraOn': '✓ New paragraph starts here', 'menu.paraSet': 'Start a new paragraph here (not shown early)', 'menu.paraAuto': 'Paragraph break: back to auto',
    'menu.dotsAuto': 'Count-in dots: auto', 'menu.dotsOn': 'Count-in dots: show', 'menu.dotsOff': 'Count-in dots: hide',
    'menu.rowAuto': 'Row: auto', 'menu.row': 'Row: {n}',
    'menu.dup': 'Duplicate as harmony line (shown and wiped together)', 'menu.split': 'Split at playhead', 'menu.merge': 'Merge with next line',
    'menu.resetShow': 'Reset show / hide times to auto', 'menu.del': 'Delete this line', 'menu.add': 'Add a lyric line here',

    'line.help_html': 'Select a lyric line in the preview, the timeline or the list on the left.<br><br>· Drag the <b>wipe cursor</b> (line + dot) in the preview to retime on the spot<br>· On the timeline, drag a block to move the whole line; drag the small ticks in its lower half to adjust single characters<br>· The thin edges on either side set when the line appears / disappears<br>· Right-click a block for paragraphs, count-in dots, harmony lines, split and merge',
    'line.text': 'Lyrics (furigana: 漢字{かんじ})',
    'line.startEnd': 'Start / End', 'line.rowAlign': 'Row / Align',
    'line.rowAutoN': 'Auto ({n})', 'line.rowN': 'Row {n}',
    'line.alignAuto': 'Auto', 'line.left': 'Left', 'line.center': 'Center', 'line.right': 'Right',
    'line.para': 'Paragraph', 'line.paraAutoY': 'Auto (break)', 'line.paraAutoN': 'Auto (no break)', 'line.paraOn': 'Break here', 'line.paraOff': 'No break',
    'line.dots': 'Count-in', 'line.dotsAutoY': 'Auto (on)', 'line.dotsAutoN': 'Auto (off)', 'line.dotsOn': 'Show', 'line.dotsOff': 'Hide',
    'line.show': 'Appears at', 'line.hide': 'Disappears at', 'line.auto': 'Auto', 'line.resetAuto': 'Reset',
    'line.even': 'Even split', 'line.dup': 'Harmony copy', 'line.split': 'Split at playhead', 'line.merge': 'Merge next', 'line.del': 'Delete',
    'line.tap_html': 'Tap timing: during playback, each press of <kbd>T</kbd> stamps the start of the next character; characters with furigana are tapped one mora at a time (now {cur} / {total}; one more press ends the line and moves on to the next).',
    'line.thChar': 'Char', 'line.thRuby': 'Ruby', 'line.thStart': 'Start (s)',
    'line.atTip': "Set this character's start to the current playback time", 'line.atMoraTip': "Set this mora's start to the current playback time",

    'f.font': 'Font', 'f.fontCss': 'Family (CSS)', 'f.sysFonts': 'Load system fonts', 'f.fontFile': 'Load font file…',
    'f.weight': 'Weight', 'f.wNormal': 'Regular', 'f.wBold': 'Bold', 'f.wBlack': 'Black',
    'f.size': 'Size', 'f.rubyRatio': 'Ruby scale', 'f.rubyGap': 'Ruby gap', 'f.spacing': 'Letter spacing',
    'f.colors': 'Colors (unsung / sung)', 'f.fill': 'Lyric fill', 'f.stroke': 'Lyric outline', 'f.rubyFill': 'Ruby fill', 'f.rubyStroke': 'Ruby outline',
    'f.strokeW': 'Outline width', 'f.rubyStrokeW': 'Ruby outline w.', 'f.glowColor': 'Glow', 'f.glow': 'Glow strength',
    'f.bg': 'Background', 'f.bgMode': 'Mode', 'f.bgNone': 'Transparent (checker)', 'f.bgColor': 'Solid color', 'f.bgColors': 'Solid / key color',
    'f.videoBg': 'Video as BG', 'f.videoBgHint': 'Preview / recording only',
    'f.canvas': 'Canvas', 'f.size2': 'Canvas W×H', 'f.layout': 'Multi-row', 'f.duet': 'Staggered (L, R, C)', 'f.stack': 'All centered',
    'f.rows': 'Auto rows', 'f.rowsOne': '{n} row', 'f.rowsN': '{n} rows',
    'f.posY': 'Row 1 baseline', 'f.lineGap': 'Row spacing', 'f.marginX': 'Side margin', 'f.maxW': 'Max width',
    'f.showHide': 'Show & hide', 'f.preShow': 'Max pre-show (s)', 'f.lead': 'Min lead (s)', 'f.hold': 'Hold after (s)', 'f.fade': 'Fade in / out (s)',
    'f.paraDots': 'Paragraphs & count-in', 'f.paraGap': 'Auto break gap (s)', 'f.dots': 'Count-in dots', 'f.dotsHint': '3 dots before each paragraph',
    'f.dotsDur': 'Countdown (s)', 'f.dotSize': 'Dot size', 'f.sync': 'Sync', 'f.offset': 'Global offset (s)',
    'f.current': '{name} (current)', 'f.grpLoaded': 'Loaded font files', 'f.grpCommon': 'Common', 'f.grpLocal': 'System fonts',
    'f.localOk': 'Loaded {n} system fonts; pick one from the Font list',
    'f.localDenied': 'Access to system fonts was denied (you can allow it again in the site settings left of the address bar)',
    'f.localNA': "This browser can't list system fonts. Type a font name into Family (CSS), or load a font file",
    'f.fileLoaded': 'Loaded font “{name}” (font files are not stored in the project; load it again next time or install it)',

    'tl.row': 'Row {n}',

    'msg.bigMedia': 'Large file: no waveform is drawn (syncing still works)',
    'msg.noWave': "Couldn't decode the audio waveform (syncing still works)",
    'msg.saved': 'Saved to {name}', 'msg.saveFail': 'Save failed: {msg}',
    'msg.srt': 'SRT imported: characters are spread evenly across each line. Retime by tapping (T) or dragging the cursor',
    'msg.readFail': "Couldn't read the file: {msg}",
    'msg.confirmSample': 'Loading a sample replaces the current project (unsaved changes will be lost). Continue?',
    'msg.confirmNew': 'A new project clears the current one (unsaved changes will be lost). Continue?',
  };

  K.I18N = D;
  K.LANGS = [['zh-CN', '中文'], ['ja', '日本語'], ['en', 'English']];
  const LK = 'karaoke-studio:lang';
  const norm = (c) => { c = String(c || '').toLowerCase(); return c.startsWith('zh') ? 'zh-CN' : c.startsWith('ja') ? 'ja' : c.startsWith('en') ? 'en' : null; };
  const detect = () => {
    let q = null; try { q = norm(new URLSearchParams(location.search).get('lang')); } catch (e) {}
    if (q) return q;
    let s = null; try { s = D[localStorage.getItem(LK)] ? localStorage.getItem(LK) : null; } catch (e) {}
    if (s) return s;
    for (const l of navigator.languages || [navigator.language]) { const n = norm(l); if (n) return n; }
    return 'en';
  };

  K.has = (key) => D[K.lang][key] != null || D['zh-CN'][key] != null;
  K.t = (key, p) => {
    const s = D[K.lang][key] != null ? D[K.lang][key] : D['zh-CN'][key] != null ? D['zh-CN'][key] : key;
    return p ? s.replace(/\{(\w+)\}/g, (m, k) => (p[k] != null ? String(p[k]) : m)) : s;
  };
  K.tAll = (key) => Object.keys(D).map((l) => D[l][key]).filter((v) => v != null);   // 某个 key 在所有语言里的文案

  /* 静态 HTML：data-i18n（文本）/ data-i18n-title / data-i18n-placeholder */
  K.applyI18n = (root) => {
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = K.t(el.dataset.i18n)));
    root.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = K.t(el.dataset.i18nTitle)));
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => (el.placeholder = K.t(el.dataset.i18nPlaceholder)));
    document.documentElement.lang = K.lang;
    /* 画布上的界面文字（时间线）跟随 CSS 里按语言定义的字体族 */
    K.uiFamily = getComputedStyle(document.documentElement).getPropertyValue('--ui').trim() || 'sans-serif';
  };
  K.uiFont = (px) => px + 'px ' + K.uiFamily;

  K.setLang = (code) => {
    code = D[code] ? code : norm(code); if (!code) return;
    K.lang = code;
    try { localStorage.setItem(LK, code); } catch (e) {}
    try { const u = new URL(location.href); if (u.searchParams.has('lang')) { u.searchParams.set('lang', code); history.replaceState(null, '', u.href); } } catch (e) {}
    K.applyI18n(); if (K.invalidate) K.invalidate(); K.emit('lang');
  };

  K.lang = detect();
  K.applyI18n();
})();
