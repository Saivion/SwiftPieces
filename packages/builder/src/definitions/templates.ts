// Free starting points. Each is plain data: a tree of registry components with the props that
// differ from their defaults. The builder runs it through validation, which fills the defaults, so
// a template can never contain anything the registry can't render and export.
import type { Props, ScreenNode, TemplateDefinition } from "../core/schema.js";

/** Node shorthand for templates. Ids are assigned when the template is created. */
export function nd(component: string, props: Props = {}, children?: ScreenNode[]): ScreenNode {
  return { id: "", component, props, ...(children ? { children } : {}) };
}

/** Gives every node in a template tree a fresh id. */
export function withIds(node: ScreenNode, newId: () => string): ScreenNode {
  return { ...node, id: newId(), ...(node.children ? { children: node.children.map((c) => withIds(c, newId)) } : {}) };
}

export function singleScreen(name: string, viewName: string, root: ScreenNode): (newId: () => string) => ReturnType<TemplateDefinition["create"]> {
  return (newId) => ({ name, shell: "single", screens: [{ id: newId(), name: viewName, root: withIds(root, newId) }] });
}

const heading = (text: string, extra: Props = {}) => nd("text", { text, style: "largeTitle", weight: "bold", ...extra });
const body = (text: string, extra: Props = {}) => nd("text", { text, style: "body", color: "secondary", ...extra });

export const loginTemplate: TemplateDefinition = {
  id: "login",
  name: "Login",
  group: "Account",
  description: "Email and password, Sign in with Apple, and a way to reset.",
  availability: "free",
  create: singleScreen("Login", "LoginView", nd("screen", { appearance: "dark", alignment: "leading", spacing: 16 }, [
    nd("symbol", { icon: "sparkles", size: 28, badge: "rounded" }),
    heading("Welcome back"),
    body("Sign in to pick up where you left off."),
    nd("spacer", { mode: "fixed", height: 8 }),
    nd("input", { label: "Email", placeholder: "you@example.com", icon: "envelope", content: "email" }),
    nd("input", { label: "Password", placeholder: "Password", icon: "lock", content: "password", secure: true }),
    nd("button", { title: "Forgot password?", style: "plain", size: "small", fullWidth: false }),
    nd("button", { title: "Sign in", style: "filled", size: "large", fullWidth: true }),
    nd("apple-sign-in", { style: "white" }),
    nd("hstack", { spacing: 4 }, [nd("text", { text: "New here?", style: "footnote", color: "secondary" }), nd("button", { title: "Create an account", style: "plain", size: "small", fullWidth: false })]),
  ])),
};

export const signUpTemplate: TemplateDefinition = {
  id: "sign-up",
  name: "Sign Up",
  group: "Account",
  description: "Floating-label fields, a password strength meter and a button that shows its progress.",
  availability: "free",
  create: singleScreen("SignUp", "SignUpView", nd("screen", { appearance: "dark", alignment: "leading", spacing: 16, title: "" }, [
    heading("Create your account"),
    body("It takes less than a minute."),
    nd("form-field", { label: "Name", prompt: "", icon: "person", content: "name" }),
    nd("form-field", { label: "Email", prompt: "you@example.com", icon: "envelope", content: "email", help: "We send a sign-in link here." }),
    nd("secure-entry", { label: "Password" }),
    nd("commit-button", { title: "Create account", successTitle: "Welcome" }),
    nd("text", { text: "By continuing you agree to the Terms and Privacy Policy.", style: "caption", color: "secondary" }),
  ])),
};

export const onboardingTemplate: TemplateDefinition = {
  id: "onboarding",
  name: "Onboarding",
  group: "First run",
  description: "A welcome with an animated headline and one clear next step.",
  availability: "free",
  create: singleScreen("Welcome", "WelcomeView", nd("screen", { appearance: "dark", scrolls: false, position: "center", alignment: "leading", spacing: 20 }, [
    nd("spacer"),
    nd("symbol", { icon: "hand.wave", size: 34, badge: "circle", color: "yellow" }),
    nd("text-reveal", { text: "Plan the week in one calm glance.", highlights: "one calm glance", size: 40 }),
    body("Three priorities, two open loops and a clear Monday. Set up takes a minute."),
    nd("spacer"),
    nd("elastic-button", { title: "Get started", icon: "arrow.right", style: "signal" }),
    nd("button", { title: "I already have an account", style: "plain", size: "regular", fullWidth: true }),
  ])),
};

export const profileTemplate: TemplateDefinition = {
  id: "profile",
  name: "Profile",
  group: "Account",
  description: "An avatar, stats and the rows people expect under a profile.",
  availability: "free",
  create: singleScreen("Profile", "ProfileView", nd("screen", { title: "Profile", appearance: "dark", alignment: "center", spacing: 16 }, [
    nd("symbol", { icon: "person.crop.circle.fill", size: 84, color: "gray" }),
    nd("vstack", { alignment: "center", spacing: 4 }, [
      nd("text", { text: "Sam Rivera", style: "title2", weight: "bold" }),
      nd("text", { text: "@samrivera · Lisbon", style: "subheadline", color: "secondary" }),
    ]),
    nd("hstack", { spacing: 12 }, [
      nd("vstack", { alignment: "center", spacing: 2, style: "card", padding: 14, radius: 14 }, [nd("text", { text: "128", style: "title3", weight: "bold" }), nd("text", { text: "Posts", style: "caption", color: "secondary" })]),
      nd("vstack", { alignment: "center", spacing: 2, style: "card", padding: 14, radius: 14 }, [nd("text", { text: "4.2k", style: "title3", weight: "bold" }), nd("text", { text: "Followers", style: "caption", color: "secondary" })]),
      nd("vstack", { alignment: "center", spacing: 2, style: "card", padding: 14, radius: 14 }, [nd("text", { text: "310", style: "title3", weight: "bold" }), nd("text", { text: "Following", style: "caption", color: "secondary" })]),
    ]),
    nd("button", { title: "Edit profile", style: "tinted", size: "large", fullWidth: true }),
    nd("vstack", { alignment: "leading", spacing: 0, style: "card", padding: 16, radius: 16 }, [
      nd("row", { icon: "bookmark", iconColor: "blue", title: "Saved", value: "24" }),
      nd("divider"),
      nd("row", { icon: "clock", iconColor: "orange", title: "History" }),
      nd("divider"),
      nd("row", { icon: "shield", iconColor: "green", title: "Privacy" }),
    ]),
  ])),
};

export const settingsTemplate: TemplateDefinition = {
  id: "settings",
  name: "Settings",
  group: "Account",
  description: "Grouped rows with icons, switches and a sign-out button.",
  availability: "free",
  create: singleScreen("Settings", "SettingsView", nd("screen", { title: "Settings", appearance: "dark", background: "grouped", alignment: "leading", spacing: 20, padding: 20 }, [
    nd("vstack", { spacing: 0, style: "card", padding: 16, radius: 16 }, [
      nd("row", { icon: "bell", iconColor: "red", title: "Notifications", accessory: "toggle", isOn: true }),
      nd("divider"),
      nd("row", { icon: "moon", iconColor: "indigo", title: "Appearance", value: "Dark" }),
      nd("divider"),
      nd("row", { icon: "lock", iconColor: "blue", title: "Privacy & Security" }),
    ]),
    nd("vstack", { spacing: 0, style: "card", padding: 16, radius: 16 }, [
      nd("row", { icon: "bubble.left", iconColor: "green", title: "Help & Feedback" }),
      nd("divider"),
      nd("row", { icon: "star", iconColor: "orange", title: "Rate the App" }),
      nd("divider"),
      nd("row", { icon: "globe", iconColor: "gray", title: "About", value: "1.0", accessory: "none" }),
    ]),
    nd("button", { title: "Sign out", style: "tinted", size: "large", fullWidth: true, tint: "red" }),
  ])),
};

export const emptyStateTemplate: TemplateDefinition = {
  id: "empty-state",
  name: "Empty State",
  group: "States",
  description: "What people see before there is anything to show, with one way forward.",
  availability: "free",
  create: singleScreen("Invoices", "InvoicesView", nd("screen", { appearance: "dark", scrolls: false }, [
    nd("outcome-screen", { outcome: "empty", eyebrow: "Invoices", title: "No invoices yet", message: "Invoices you send to clients show up here.", primaryTitle: "New invoice" }),
  ])),
};

/** A blank screen, for people who want to start from nothing. */
export const blankTemplate: TemplateDefinition = {
  id: "blank",
  name: "Blank",
  group: "Start",
  description: "An empty screen.",
  availability: "free",
  create: singleScreen("MyApp", "ContentView", nd("screen", { alignment: "leading" }, [])),
};

export const freeTemplates: TemplateDefinition[] = [loginTemplate, signUpTemplate, onboardingTemplate, profileTemplate, settingsTemplate, emptyStateTemplate];
