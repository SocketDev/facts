export type ResolutionFailure = {
  coord: string
  // Build tool's own failure message (deepest cause; may be multi-line).
  // Classified on; first line shown by default, whole thing at --verbose.
  detail: string
  config: string
}

// A whole config whose resolution threw, vs a single unresolved dep (`ResolutionFailure`).
export type UnscannableConfig = {
  config: string
  detail: string
}

export type ResolutionReport = {
  // Which configs each first-party project resolved. `scannedConfigs` is a
  // flat union across the whole build, which loses attribution as soon as two
  // projects resolve different configs.
  configsByProject: Array<{ project: string; configs: string[] }>
  failures: ResolutionFailure[]
  scannedConfigs: string[]
  unscannable: UnscannableConfig[]
}
