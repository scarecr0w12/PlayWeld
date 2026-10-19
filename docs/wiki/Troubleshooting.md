# Troubleshooting

Record Project/profile, version/commit, last successful action, first failure and sanitized task/run/call IDs. Inspect the original request before retrying; a duplicate may collide with running work.

| Symptom                         | First check                                                 |
| ------------------------------- | ----------------------------------------------------------- |
| Missing screen/control          | Menu, active section, Project selector, collapsed controls  |
| Cannot connect                  | Same profile, service status, matching app/service versions |
| Denied/waiting tool             | Audit decision, access ceiling, approval/question, timeout  |
| No eligible model               | Enabled state, capabilities, pools/roles, budget            |
| Search misses saved edits       | Pending/errors, reconcile, exact lexical phrase/source      |
| Engine detected but unavailable | Native files and capability-layer reason                    |
| Wrong editor identity           | Actual native path and bridge reply                         |
| Job without import              | Provider terminal state, files and human review             |
| Native module load failure      | OS/ABI; separate Windows/Linux modules                      |

## Service diagnosis

From a built source checkout with the intended GAMECRAFTER_PROFILE_DIR:

```bash
node packages/platform-service/lib/cli.js status
```

The desktop normally starts the service. Source diagnostics can use start --foreground. Start/stop affects that profile, so preserve unrelated work. Closing a window need not stop the daemon: window.closeBehavior defaults to continue.

Do not delete lifecycle/database files or kill arbitrary processes as the first fix. A random replacement credentials.key cannot decrypt old accounts; restore protected material from a complete backup or re-enter credentials in the UI.

## Report one reproducible problem

Search [existing issues](https://github.com/scarecr0w12/PlayWeld/issues). Include OS, installed/source target, version, steps, expected/actual behavior and sanitized evidence. Remove credentials, tokens, recovery secrets, private files and personal paths; preserve original failures locally.

The [operations symptom table](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/OPERATIONS_GUIDE.md#troubleshooting) and [recovery procedures](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/OPERATIONS_GUIDE.md#recovery-procedures-by-state-owner) own detailed corrective steps.
