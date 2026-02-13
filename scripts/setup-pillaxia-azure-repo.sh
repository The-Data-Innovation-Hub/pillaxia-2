#!/usr/bin/env bash
# Create a new GitHub repo 'pillaxia-azure' and push this codebase (including .github/workflows) to it.
# Prerequisites: gh CLI (brew install gh), gh auth login, and git remote 'origin' pointing at pillaxia-2.
#
# Usage: ./scripts/setup-pillaxia-azure-repo.sh
# Or:    GITHUB_ORG=your-org ./scripts/setup-pillaxia-azure-repo.sh

set -e
cd "$(dirname "$0")/.."

REPO_NAME="${REPO_NAME:-pillaxia-azure}"
GITHUB_ORG="${GITHUB_ORG:-}"   # Leave empty for your user account; set to org name if under an org

if ! command -v gh &>/dev/null; then
  echo "ERROR: GitHub CLI (gh) is not installed. Install: brew install gh" >&2
  exit 1
fi

echo "Creating repo: $REPO_NAME"
if [ -n "$GITHUB_ORG" ]; then
  gh repo create "$GITHUB_ORG/$REPO_NAME" --private --source=. --remote=azure --push --description "Pillaxia Azure deployment (API, Functions, Static Web App, migrations)"
else
  gh repo create "$REPO_NAME" --private --source=. --remote=azure --push --description "Pillaxia Azure deployment (API, Functions, Static Web App, migrations)"
fi

echo ""
echo "Done. Code (including .github/workflows) has been pushed to the 'azure' remote."
echo "Next steps:"
echo "  1. In GitHub: $REPO_NAME → Settings → Secrets and variables → Actions"
echo "  2. Add the same secrets as pillaxia-2 (AZURE_API_PUBLISH_PROFILE, AZURE_API_APP_NAME, etc.)"
echo "  3. Default branch is the one you pushed; adjust in Settings → General if needed."
echo ""
echo "To push future updates: git push azure main"
