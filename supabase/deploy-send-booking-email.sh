#!/usr/bin/env bash
# Run from repo root: bash supabase/deploy-send-booking-email.sh
# Requires: Node/npm (uses npx). First time: supabase login opens in browser.

set -e
cd "$(dirname "$0")/.."
npx --yes supabase@latest functions deploy send-booking-email --project-ref jwckqgkhnylioanmmtgt
echo "Done. Set secrets in Dashboard or: npx supabase@latest secrets set RESEND_API_KEY=... --project-ref jwckqgkhnylioanmmtgt"
