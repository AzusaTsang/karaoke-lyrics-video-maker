#!/usr/bin/env bash
# 冒烟测试：用无头 Chrome 打开应用，模拟拖动 / 快捷键 / 切换语言等操作并逐条断言。
# 输出 PASS/FAIL 汇总；有失败、异常或没拿到结果时退出码非 0。CHROME 环境变量可指定浏览器路径。
cd "$(dirname "$0")/.." || exit 1
CH="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
sed 's#</body>#<script src="tests/smoke.js"></script></body>#' index.html > _test.html
DOM="$("$CH" --headless=new --disable-gpu --allow-file-access-from-files --autoplay-policy=no-user-gesture-required \
  --window-size=1720,1000 --virtual-time-budget=20000 \
  --dump-dom "file:///$(pwd -W 2>/dev/null || pwd)/_test.html" 2>/dev/null)"
rm -f _test.html
RES="$(printf '%s' "$DOM" | sed -n '/<pre id="result">/,/<\/pre>/p' | sed -e 's#.*<pre id="result">##' -e 's#</pre>.*##' \
  -e 's/&quot;/"/g' -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&amp;/\&/g')"
if [ -z "$RES" ]; then echo "FAIL: no result (page did not finish within the time budget, or failed to load)"; exit 1; fi
HEAD="$(printf '%s\n' "$RES" | head -n 1)"
if [ "${VERBOSE:-}" = 1 ] || [ "${HEAD#PASS}" = "$HEAD" ]; then printf '%s\n' "$RES" | tail -n +2; fi
echo "$HEAD"
case "$HEAD" in PASS*) ;; *) exit 1 ;; esac
printf '%s\n' "$RES" | grep -q '"error": "' && { echo "FAIL: error field present"; exit 1; }
exit 0
