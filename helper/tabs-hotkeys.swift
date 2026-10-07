// tabs-hotkeys: the keyboard half of the project-tabs mod.
//
// A mod cannot bind keys app-wide in Claude Desktop, so this small agent does:
// while Claude Desktop is the frontmost app it holds ⌃1…⌃9 (or ⌘1…⌘9), and a
// press opens the deep link the mod wrote for that tab. When another app comes
// to the front the keys are released, so they keep working everywhere else.
//
// The mod writes ~/.claude/project-tabs/hotkeys.json:
//   { "modifier": "control" | "command" | "off", "targets": ["claude://…", null, …] }
// and runs this agent under launchd. It needs no permissions: Carbon hot keys
// are delivered to the registering app without Accessibility access.

import Carbon.HIToolbox
import Cocoa

let claudeBundleId = "com.anthropic.claudefordesktop"
let configDir = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".claude/project-tabs")
let configURL = configDir.appendingPathComponent("hotkeys.json")

struct Config: Decodable {
  let modifier: String
  let targets: [String?]
}

func loadConfig() -> Config? {
  guard let data = try? Data(contentsOf: configURL) else { return nil }
  return try? JSONDecoder().decode(Config.self, from: data)
}

/// The keys 1…9 on the number row, in order.
let digitKeys: [Int] = [
  kVK_ANSI_1, kVK_ANSI_2, kVK_ANSI_3, kVK_ANSI_4, kVK_ANSI_5,
  kVK_ANSI_6, kVK_ANSI_7, kVK_ANSI_8, kVK_ANSI_9,
]
let signature: OSType = 0x434C_5442  // "CLTB"

var registered: [EventHotKeyRef] = []
var registeredModifier = ""

func unregisterAll() {
  for ref in registered { UnregisterEventHotKey(ref) }
  registered = []
  registeredModifier = ""
}

func registerAll() {
  let modifier = loadConfig()?.modifier ?? "off"
  if modifier == registeredModifier, !registered.isEmpty { return }
  unregisterAll()
  guard modifier == "control" || modifier == "command" else { return }
  let mask = UInt32(modifier == "command" ? cmdKey : controlKey)
  for (index, key) in digitKeys.enumerated() {
    var ref: EventHotKeyRef?
    let id = EventHotKeyID(signature: signature, id: UInt32(index + 1))
    if RegisterEventHotKey(UInt32(key), mask, id, GetApplicationEventTarget(), 0, &ref) == noErr,
      let ref
    {
      registered.append(ref)
    }
  }
  registeredModifier = modifier
}

func openTab(_ index: Int) {
  guard let config = loadConfig(), index < config.targets.count,
    let target = config.targets[index], let url = URL(string: target)
  else { return }
  NSWorkspace.shared.open(url)
}

func claudeIsFrontmost() -> Bool {
  NSWorkspace.shared.frontmostApplication?.bundleIdentifier == claudeBundleId
}

var pressed = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
InstallEventHandler(
  GetApplicationEventTarget(),
  { _, event, _ in
    var id = EventHotKeyID()
    let status = GetEventParameter(
      event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID),
      nil, MemoryLayout<EventHotKeyID>.size, nil, &id)
    if status == noErr, id.signature == signature { openTab(Int(id.id) - 1) }
    return noErr
  }, 1, &pressed, nil, nil)

// Hold the keys only while Claude Desktop is in front.
NSWorkspace.shared.notificationCenter.addObserver(
  forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main
) { note in
  let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication
  if app?.bundleIdentifier == claudeBundleId { registerAll() } else { unregisterAll() }
}
if claudeIsFrontmost() { registerAll() }

// A change of modifier in the mod's pane takes effect without a restart.
Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { _ in
  if claudeIsFrontmost() { registerAll() } else if !registered.isEmpty { unregisterAll() }
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
app.run()
