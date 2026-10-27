# Keep GitHub publication notes within the service limit

**Release:** 0.23.0

**Impact:** none

**Category:** Maintenance

## Summary

Publish concise version notes and attach the complete permanent 0.23.0 notes instead of submitting an oversized release body.

## Details

The generated 0.23.0 notes exceeded 181 KB. GitHub's release API reports a maximum body length of 125,000 characters, so passing that file directly to publication would fail after packaging. Validate an independently authored, nonempty version summary before native packaging; use that summary as the draft release body and upload the complete generated notes as a separate Markdown asset. Keep all permanent records, detailed version notes and the full changelog intact. Future preparations must author their version summary before release packaging. No package/runtime/schema, security permission, signing key or credential change is introduced.

## Validation

- Verified the service's actual 125,000-character error in [a public GitHub Actions API error annotation](https://github.com/music-assistant/server/actions/runs/18089326861). The generated notes exceed that limit; the concise 0.23.0 summary is below it.
- Validated workflow YAML and the publication-note guard with current notes, an empty body and an oversized Unicode body. Full notes remain byte-for-byte the generated version artifact. Protected PR and native packaging checks are subsequent gates, not claimed by this record.
- No tag, release publication, installed upgrade or signing acceptance is established by this tooling correction.

## Files

- `.github/workflows/release.yml`
- `docs/releases/v0.23.0-summary.md`
- `docs/RELEASE_GUIDE.md`
