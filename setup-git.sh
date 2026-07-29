#!/bin/bash
# Reinitializes the dara-bot git repo if .git gets wiped by Replit checkpoints.
# Run: bash setup-git.sh

REMOTE="https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/adtelecominfo-png/DaraTech-Bot-V1.git"

if [ -d ".git" ] && [ -f ".git/config" ]; then
  echo "✅ Git already initialized."
  git remote set-url origin "$REMOTE" 2>/dev/null
  git fetch origin --quiet
  echo "📌 HEAD: $(git log --oneline -1 origin/main)"
  exit 0
fi

echo "⚙️  Reinitializing git..."
rm -rf .git
git init
git remote add origin "$REMOTE"
git fetch origin
git reset origin/main
echo "✅ Done — local is now at: $(git log --oneline -1 HEAD)"
