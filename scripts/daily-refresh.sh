#!/bin/zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd /Users/zhangxin/Documents/盈小花
/opt/homebrew/bin/npm run refresh:export
/opt/homebrew/bin/npm run publish:pages
