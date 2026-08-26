#!/bin/sh

set -eu

restore_terminal() {
  stty echo 2>/dev/null || true
  unset DATABASE_URL
}
trap restore_terminal EXIT HUP INT TERM

printf "Production DATABASE_URL (input hidden): "
stty -echo
IFS= read -r DATABASE_URL
stty echo
printf "\n"

case "$DATABASE_URL" in
  postgresql://*) ;;
  *)
    printf "Error: DATABASE_URL must begin with postgresql://\n" >&2
    exit 1
    ;;
esac

export DATABASE_URL
pnpm db:deploy
