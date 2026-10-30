#!/bin/bash
# Vercel "Ignored Build Step": exit 0 = skip the build, exit 1 = run it.
# Production (main) always builds. Preview builds only run when the latest
# commit message contains [preview], to stay inside the free plan's daily limit.

if [ "$VERCEL_ENV" = "production" ]; then
  echo "Production deploy: building."
  exit 1
fi

if [[ "$VERCEL_GIT_COMMIT_MESSAGE" == *"[preview]"* ]]; then
  echo "Commit contains [preview]: building."
  exit 1
fi

echo "Preview skipped: add [preview] to the commit message to build."
exit 0
