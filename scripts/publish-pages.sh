#!/bin/zsh
set -euo pipefail

cd /Users/zhangxin/Documents/盈小花

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "未配置 GitHub remote，跳过公开链接同步。"
  exit 0
fi

git add index.html pages/index.html pages/.nojekyll pages/README.md

if git diff --cached --quiet; then
  echo "公开页没有变化，无需同步。"
  exit 0
fi

git commit -m "Update settlement dashboard public page"
git push origin HEAD
