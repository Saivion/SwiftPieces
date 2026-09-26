// A complete, minimal Xcode 16 project for an exported app. It uses a synchronized root folder
// (objectVersion 77), so the project file never lists individual sources: every Swift file, Metal
// shader and asset catalog under MyApp/ is part of the target, including SwiftPieces sources.

export type SourceFile = { path: string; content: string };

export type XcodeProjectInput = {
  appName: string;
  /** Files inside the app folder, e.g. "LoginView.swift", "SwiftPieces/Controls/ElasticButton.swift". */
  sources: SourceFile[];
  bundleIdPrefix?: string;
  minIOS?: string;
  /** Extra README sections, e.g. capabilities to enable. */
  notes?: string[];
};

/** 24-hex-digit object ids derived from a name, so the same app always gets the same ids. */
function objectId(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0x5bd1e995;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822507) >>> 0;
    h3 = Math.imul(h3 ^ c, 3266489909) >>> 0;
  }
  return [h1, h2, h3].map((h) => h.toString(16).toUpperCase().padStart(8, "0")).join("");
}

function pbxproj(app: string, bundleId: string, minIOS: string): string {
  const id = (k: string) => objectId(`${app}:${k}`);
  const P = {
    product: id("product"), group: id("group"), frameworks: id("frameworks"), main: id("main"), products: id("products"),
    target: id("target"), targetConfigs: id("targetConfigs"), sources: id("sources"), resources: id("resources"),
    project: id("project"), projectConfigs: id("projectConfigs"),
    projDebug: id("projDebug"), projRelease: id("projRelease"), tgtDebug: id("tgtDebug"), tgtRelease: id("tgtRelease"),
  };
  const common = [
    "ALWAYS_SEARCH_USER_PATHS = NO;",
    "ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;",
    "CLANG_ANALYZER_NONNULL = YES;",
    "CLANG_CXX_LANGUAGE_STANDARD = \"gnu++20\";",
    "CLANG_ENABLE_MODULES = YES;",
    "CLANG_ENABLE_OBJC_ARC = YES;",
    "COPY_PHASE_STRIP = NO;",
    "ENABLE_STRICT_OBJC_MSGSEND = YES;",
    "ENABLE_USER_SCRIPT_SANDBOXING = YES;",
    "GCC_C_LANGUAGE_STANDARD = gnu17;",
    "GCC_NO_COMMON_BLOCKS = YES;",
    `IPHONEOS_DEPLOYMENT_TARGET = ${minIOS};`,
    "LOCALIZATION_PREFERS_STRING_CATALOGS = YES;",
    "MTL_FAST_MATH = YES;",
    "SDKROOT = iphoneos;",
  ];
  const projDebug = [
    ...common,
    "DEBUG_INFORMATION_FORMAT = dwarf;",
    "ENABLE_TESTABILITY = YES;",
    "GCC_DYNAMIC_NO_PIC = NO;",
    "GCC_OPTIMIZATION_LEVEL = 0;",
    "GCC_PREPROCESSOR_DEFINITIONS = (\n\t\t\t\t\t\"DEBUG=1\",\n\t\t\t\t\t\"$(inherited)\",\n\t\t\t\t);",
    "MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;",
    "ONLY_ACTIVE_ARCH = YES;",
    "SWIFT_ACTIVE_COMPILATION_CONDITIONS = \"DEBUG $(inherited)\";",
    "SWIFT_OPTIMIZATION_LEVEL = \"-Onone\";",
  ];
  const projRelease = [
    ...common,
    "DEBUG_INFORMATION_FORMAT = \"dwarf-with-dsym\";",
    "ENABLE_NS_ASSERTIONS = NO;",
    "MTL_ENABLE_DEBUG_INFO = NO;",
    "SWIFT_COMPILATION_MODE = wholemodule;",
    "VALIDATE_PRODUCT = YES;",
  ];
  const target = [
    "ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;",
    "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;",
    "CODE_SIGN_STYLE = Automatic;",
    "CURRENT_PROJECT_VERSION = 1;",
    "ENABLE_PREVIEWS = YES;",
    "GENERATE_INFOPLIST_FILE = YES;",
    "INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;",
    "INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;",
    "INFOPLIST_KEY_UILaunchScreen_Generation = YES;",
    "INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = \"UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight\";",
    "INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = \"UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight\";",
    "LD_RUNPATH_SEARCH_PATHS = (\n\t\t\t\t\t\"$(inherited)\",\n\t\t\t\t\t\"@executable_path/Frameworks\",\n\t\t\t\t);",
    "MARKETING_VERSION = 1.0;",
    `PRODUCT_BUNDLE_IDENTIFIER = ${bundleId};`,
    "PRODUCT_NAME = \"$(TARGET_NAME)\";",
    "SWIFT_EMIT_LOC_STRINGS = YES;",
    "SWIFT_VERSION = 5.0;",
    "TARGETED_DEVICE_FAMILY = \"1,2\";",
  ];
  const settings = (lines: string[]) => lines.map((l) => `\t\t\t\t${l}`).join("\n");
  const config = (oid: string, name: string, lines: string[]) =>
    `\t\t${oid} /* ${name} */ = {\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {\n${settings(lines)}\n\t\t\t};\n\t\t\tname = ${name};\n\t\t};`;

  return `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 77;
	objects = {

/* Begin PBXFileReference section */
		${P.product} /* ${app}.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = ${app}.app; sourceTree = BUILT_PRODUCTS_DIR; };
/* End PBXFileReference section */

/* Begin PBXFileSystemSynchronizedRootGroup section */
		${P.group} /* ${app} */ = {
			isa = PBXFileSystemSynchronizedRootGroup;
			path = ${app};
			sourceTree = "<group>";
		};
/* End PBXFileSystemSynchronizedRootGroup section */

/* Begin PBXFrameworksBuildPhase section */
		${P.frameworks} /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		${P.main} = {
			isa = PBXGroup;
			children = (
				${P.group} /* ${app} */,
				${P.products} /* Products */,
			);
			sourceTree = "<group>";
		};
		${P.products} /* Products */ = {
			isa = PBXGroup;
			children = (
				${P.product} /* ${app}.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		${P.target} /* ${app} */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = ${P.targetConfigs} /* Build configuration list for PBXNativeTarget "${app}" */;
			buildPhases = (
				${P.sources} /* Sources */,
				${P.frameworks} /* Frameworks */,
				${P.resources} /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			fileSystemSynchronizedGroups = (
				${P.group} /* ${app} */,
			);
			name = ${app};
			packageProductDependencies = (
			);
			productName = ${app};
			productReference = ${P.product} /* ${app}.app */;
			productType = "com.apple.product-type.application";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		${P.project} /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 1600;
				LastUpgradeCheck = 1600;
				TargetAttributes = {
					${P.target} = {
						CreatedOnToolsVersion = 16.0;
					};
				};
			};
			buildConfigurationList = ${P.projectConfigs} /* Build configuration list for PBXProject "${app}" */;
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = ${P.main};
			minimizedProjectReferenceProxies = 1;
			preferredProjectObjectVersion = 77;
			productRefGroup = ${P.products} /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				${P.target} /* ${app} */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		${P.resources} /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		${P.sources} /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
${config(P.projDebug, "Debug", projDebug)}
${config(P.projRelease, "Release", projRelease)}
${config(P.tgtDebug, "Debug", target)}
${config(P.tgtRelease, "Release", target)}
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		${P.projectConfigs} /* Build configuration list for PBXProject "${app}" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				${P.projDebug} /* Debug */,
				${P.projRelease} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		${P.targetConfigs} /* Build configuration list for PBXNativeTarget "${app}" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				${P.tgtDebug} /* Debug */,
				${P.tgtRelease} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */
	};
	rootObject = ${P.project} /* Project object */;
}
`;
}

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

function readme(app: string, notes: string[]): string {
  return [
    `# ${app}`,
    "",
    "Made with the SwiftPieces playground.",
    "",
    "## Open it",
    "",
    `1. Unzip, then double-click \`${app}.xcodeproj\`. You need Xcode 16 or later (free on the Mac App Store).`,
    "2. Pick an iPhone simulator in the toolbar and press ⌘R to run.",
    "3. Open any screen file and press ⌥⌘↩ to see its live preview next to the code.",
    "",
    "## What's inside",
    "",
    `- \`${app}/${app}App.swift\` starts the app and shows the first screen.`,
    `- One \`…View.swift\` file per screen you built.`,
    `- \`${app}/SwiftPieces/\` holds the source of every SwiftPieces component the screens use. They are yours to read and change.`,
    "- `swiftpieces.json` lets `npx swiftpieces add <Name>` drop more components straight into the project.",
    "",
    ...(notes.length ? ["## Before you ship", "", ...notes.map((n) => `- ${n}`), ""] : []),
    "## Next",
    "",
    "- Components: https://swiftpieces.com/components",
    "- Docs: https://swiftpieces.com/docs/introduction",
    "",
  ].join("\n");
}

/** Every file of the exported project, rooted at `<App>/`. */
export function xcodeProjectFiles(input: XcodeProjectInput): SourceFile[] {
  const app = input.appName;
  const minIOS = input.minIOS ?? "17.0";
  const bundleId = `${input.bundleIdPrefix ?? "com.example"}.${app}`;
  const files: SourceFile[] = [
    { path: `${app}/${app}.xcodeproj/project.pbxproj`, content: pbxproj(app, bundleId, minIOS) },
    { path: `${app}/${app}.xcodeproj/project.xcworkspace/contents.xcworkspacedata`, content: '<?xml version="1.0" encoding="UTF-8"?>\n<Workspace\n   version = "1.0">\n   <FileRef\n      location = "self:">\n   </FileRef>\n</Workspace>\n' },
    { path: `${app}/${app}/Assets.xcassets/Contents.json`, content: json({ info: { author: "xcode", version: 1 } }) },
    { path: `${app}/${app}/Assets.xcassets/AccentColor.colorset/Contents.json`, content: json({ colors: [{ idiom: "universal" }], info: { author: "xcode", version: 1 } }) },
    {
      path: `${app}/${app}/Assets.xcassets/AppIcon.appiconset/Contents.json`,
      content: json({
        images: [
          { idiom: "universal", platform: "ios", size: "1024x1024" },
          { appearances: [{ appearance: "luminosity", value: "dark" }], idiom: "universal", platform: "ios", size: "1024x1024" },
          { appearances: [{ appearance: "luminosity", value: "tinted" }], idiom: "universal", platform: "ios", size: "1024x1024" },
        ],
        info: { author: "xcode", version: 1 },
      }),
    },
    { path: `${app}/swiftpieces.json`, content: json({ $schema: "https://swiftpieces.com/schema/config.json", directory: `${app}/SwiftPieces`, minIOSVersion: minIOS, registries: { free: "https://swiftpieces.com/r", pro: "https://pro.swiftpieces.com/r" } }) },
    { path: `${app}/README.md`, content: readme(app, input.notes ?? []) },
    ...input.sources.map((s) => ({ path: `${app}/${app}/${s.path}`, content: s.content })),
  ];
  return files;
}
