# Models, privacy and cost

Local desktop/service execution does not keep every configured operation on-machine. Remote models, embeddings, asset providers and tools can receive data and incur charges.

## Configure a usable model

Open **PlayWeld > Configure & Extend > Models & Routing**. Add the correct provider kind, base URL and credentials; discover models, then explicitly add selected ones. Discovery preview is not registration. Check enabled state and required capabilities.

Named presets and generic OpenAI-compatible endpoints are implemented. A local server still needs its runtime, weights and availability; a local flag does not install them. Keys/custom secret headers use encrypted profile storage. OAuth/cloud-native IAM are outside this scope.

**Auto route** and manual selection both respect eligibility, pools, role/work-type restrictions and budgets. Unknown metadata does not satisfy required capabilities. Declared vision does not turn the common text-only chat request into image input.

## Review context and authority

**Attach active file** sends the selected editor context, not every Project file. Review it before remote requests. The builtin access.mode is ask-always; inspect tool arguments, paths and effects at approvals. Restricted can permit configured workspace writes; it does not inherently mean read-only.

Protect the profile and credentials.key together. Local encryption is not an OS-keychain promise or protection from someone who can read both.

## Interpret usage correctly

**Audit Log > Model usage** separates model estimates from **Tool calls** and **Project events**. Known subtotals cover loaded/filtered records, omit unknown portions and are not invoices or guaranteed hard spending ceilings. Missing prices are not free; configure rates. Discovery does not silently run billable completion probes.

Optional models.decisions.mode is off/shadow/assist. Empty account/model disables requests; shadow advice does not prove accuracy or savings. Remote decisions need explicit permission and disclose task/candidate data.

Read [routing](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/MODEL_ROUTING_GUIDE.md), [settings](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/SETTINGS_REFERENCE.md) and [provider guidance](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/USER_GUIDE.md#configure-models-and-routing).
