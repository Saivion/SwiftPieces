# swiftpieces

Add [Swift Pieces](https://swiftpieces.com) to your Xcode project: animated SwiftUI components, Liquid Glass effects and Metal shaders, as plain Swift source you own.

```bash
npx swiftpieces add AssistantOrb SwipeDeck
```

## Commands

| Command | What it does |
| --- | --- |
| `init` | Optional. Creates `swiftpieces.json` and a `SwiftPieces/` folder; `add` does this for you on first run. |
| `add <names...>` | Fetches pieces into your `SwiftPieces/` folder. Free pieces need nothing; Pro pieces and Build Kit items use your license key. |
| `list` | Lists available pieces. |
| `login [key]` | Stores your Swift Pieces Pro license key in `~/.swiftpieces/auth.json`. |
| `logout` | Removes the stored license key. |
| `whoami` | Checks whether the stored key has Swift Pieces Pro. |

Xcode 16+ picks up the files automatically through folder-synchronized groups. Requires Node 18.17+.

Docs: [swiftpieces.com/docs/cli](https://swiftpieces.com/docs/cli) · Pro: [pro.swiftpieces.com](https://pro.swiftpieces.com)

## License

[MIT + Commons Clause](LICENSE). Use the pieces in any app; don't sell or redistribute the pieces themselves.
