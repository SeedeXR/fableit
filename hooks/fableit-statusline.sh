#!/usr/bin/env bash
# fableit — statusline badge. Runs on every refresh, so zero forks: builtins only.
flag="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.fableit-active"
[ -f "$flag" ] || exit 0

IFS= read -r mode < "$flag" || exit 0
mode=${mode//[^a-z]/}

case "$mode" in
    full) printf '\033[38;5;110m[FABLEIT]\033[0m' ;;
    lite) printf '\033[38;5;110m[FABLEIT:LITE]\033[0m' ;;
    ultra) printf '\033[38;5;110m[FABLEIT:ULTRA]\033[0m' ;;
    *) ;; # off or unknown — no badge
esac
