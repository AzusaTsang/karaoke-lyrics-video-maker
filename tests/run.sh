#!/usr/bin/env bash
# 冒烟测试：用无头 Chrome 打开应用，模拟拖动等操作，输出一段 JSON 结果（含 "error" 即失败）
cd "$(dirname "$0")/.." || exit 1
CH="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
sed 's#</body>#<script src="tests/smoke.js"></script></body>#' index.html > _test.html
"$CH" --headless=new --disable-gpu --allow-file-access-from-files --window-size=1720,1000 --virtual-time-budget=8000 \
  --dump-dom "file:///$(pwd -W 2>/dev/null || pwd)/_test.html" 2>/dev/null | grep -o '<pre id="result">.*</pre>'
rm -f _test.html
