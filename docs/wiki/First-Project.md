# Your first Project

A Project is a registered workspace with identity, design documents, native game files and operational records. Creating it is separate from creating a runnable engine game.

## Create and open

1. Launch the desktop and wait for **Connected to platform service** in **Project Home**.
2. Choose **Create Project** there or **PlayWeld > Create Project...**.
3. Complete six steps: name, optional description, engine family, optional comma-separated genres, parent directory and confirmation.
4. Review the destination and engine carefully: engine family is immutable after creation.
5. Find the new row and choose **Open**. Confirm any trust prompt names your intended folder.

Creation establishes the manifest, Git repository, instructions and local state:

```text
gamecrafter.project.json   Project identity and engine metadata
AGENTS.md                 Instructions for this game
docs/                     Authoritative design and canon
game/                     Native game files
.agents/skills/           Project-local skills
.gamecrafter/             Operational records and artifacts
```

## Check your workspace

Open a document and verify the workspace folder and each view's Project selector agree. Add valid native files under game/ before expecting engine capabilities. An empty game/ directory is not a complete Unity, Unreal or Godot game.

Do not copy another manifest just to reuse content: it also copies identity. Use supported clone/restore for independent copies and inspect registration warnings/reconciled state.

The [user guide](https://github.com/scarecr0w12/PlayWeld/blob/main/docs/USER_GUIDE.md#create-or-open-a-project) owns detailed behavior. Continue with [Lantern Workshop](https://github.com/scarecr0w12/PlayWeld/wiki/Lantern-Workshop) for a disposable example and [notes and discussions](https://github.com/scarecr0w12/PlayWeld/wiki/Notes-and-Discussions) for design.
