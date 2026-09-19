import { DEFAULT_REGISTRIES, findConfig, readLicenseKey, writeLicenseKey } from "../config.js";
import { whoami as verify } from "../registry.js";

export async function login(key: string | undefined) {
  const licenseKey = key ?? process.env.SWIFTPIECES_LICENSE_KEY;
  if (!licenseKey) {
    console.error("Usage: npx swiftpieces login <sp_live_...>  (find your key at https://pro.swiftpieces.com/account)");
    process.exitCode = 1;
    return;
  }
  const registries = findConfig()?.config.registries ?? DEFAULT_REGISTRIES;
  const who = await verify(registries.pro, licenseKey);
  if (!who) {
    console.error("That license key was not accepted by pro.swiftpieces.com.");
    process.exitCode = 1;
    return;
  }
  const file = writeLicenseKey(licenseKey);
  const label = who.hint ? `license ${who.hint}` : "license";
  console.log(
    who.access === "pro"
      ? `Signed in with ${label}. You have Swift Pieces Pro. Key saved to ${file}.`
      : `Key saved to ${file}, but this ${label} does not include Swift Pieces Pro. Get it at https://pro.swiftpieces.com/pro`,
  );
}

export async function logout() {
  writeLicenseKey(null);
  console.log("License key removed from ~/.swiftpieces/auth.json.");
}

export async function whoami() {
  const key = readLicenseKey();
  if (!key) {
    console.log("Not signed in. Free pieces work without a key; run `npx swiftpieces login <key>` for Pro.");
    return;
  }
  const registries = findConfig()?.config.registries ?? DEFAULT_REGISTRIES;
  const who = await verify(registries.pro, key);
  if (!who) {
    console.log("Key present but not accepted by pro.swiftpieces.com.");
    return;
  }
  const label = who.hint ? `License ${who.hint}` : "License";
  console.log(who.access === "pro" ? `${label} · Swift Pieces Pro: yes` : `${label} · Swift Pieces Pro: no. Get it at https://pro.swiftpieces.com/pro`);
}
