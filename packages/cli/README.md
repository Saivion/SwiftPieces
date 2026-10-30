# swiftpieces

The CLI for [SwiftPieces](https://swiftpieces.com), a free SwiftUI component library. It copies Swift source into your Xcode project. There is no Swift package to depend on. Liquid Glass components target iOS 26 and fall back to Material. Cursor and Claude Code can install the same files through the [MCP server](https://swiftpieces.com/docs/mcp).

```bash
npx swiftpieces add AssistantOrb SwipeDeck
```

## Commands

| Command | What it does |
| --- | --- |
| `init` | Optional. Creates `swiftpieces.json` and a `SwiftPieces/` folder; `add` does this for you on first run. |
| `add <names...>` | Fetches pieces into your `SwiftPieces/` folder. Free pieces need nothing; Pro pieces and Build Kit items use your license key. |
| `list` | Lists available pieces. |
| `login [key]` | Stores your SwiftPieces Pro license key in `~/.swiftpieces/auth.json`. |
| `logout` | Removes the stored license key. |
| `whoami` | Checks whether the stored key has SwiftPieces Pro. |

Xcode 16+ picks up the files automatically through folder-synchronized groups. Requires Node 18.17+.

Files are written only inside the SwiftPieces folder (or the agent's skills folder for the Build Kit). The license key is sent only to `https://pro.swiftpieces.com` unless you pass `--trust-registry`. Registry URLs must be `https`; `--allow-http-localhost` allows a local `http` registry.

Docs: [swiftpieces.com/docs/cli](https://swiftpieces.com/docs/cli) · Pro: [pro.swiftpieces.com](https://pro.swiftpieces.com)

## License

[MIT + Commons Clause](LICENSE). Use the pieces in any app; don't sell or redistribute the pieces themselves.
