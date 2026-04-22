#!/usr/bin/env bash
# Run from repo root: bash supabase/deploy-send-contact-email.sh
# Requires: Node/npm (uses npx). First time: supabase login opens in browser.

set -e
cd "$(dirname "$0")/.."
npx --yes supabase@latest functions deploy send-contact-email --project-ref jwckqgkhnylioanmmtgt
echo "Done. Set secrets in Dashboard or: npx supabase@latest secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL=... CONTACT_OWNER_EMAIL=... --project-ref jwckqgkhnylioanmmtgt"
