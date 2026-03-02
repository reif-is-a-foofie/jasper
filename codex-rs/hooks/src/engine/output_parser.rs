use serde::Deserialize;

#[derive(Debug, Clone)]
pub(crate) struct UniversalOutput {
    pub continue_processing: bool,
    pub stop_reason: Option<String>,
    pub suppress_output: bool,
    pub system_message: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct SessionStartOutput {
    pub universal: UniversalOutput,
    pub additional_context: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct StopOutput {
    pub universal: UniversalOutput,
    pub should_block: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UniversalWire {
    #[serde(default = "default_continue")]
    r#continue: bool,
    #[serde(default)]
    stop_reason: Option<String>,
    #[serde(default)]
    suppress_output: bool,
    #[serde(default)]
    system_message: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionStartWire {
    #[serde(flatten)]
    universal: UniversalWire,
    #[serde(default)]
    hook_specific_output: Option<SessionStartSpecificWire>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionStartSpecificWire {
    hook_event_name: String,
    #[serde(default)]
    additional_context: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StopWire {
    #[serde(flatten)]
    universal: UniversalWire,
    #[serde(default)]
    decision: Option<String>,
    #[serde(default)]
    reason: Option<String>,
}

pub(crate) fn parse_session_start(stdout: &str) -> Option<SessionStartOutput> {
    let wire: SessionStartWire = parse_json(stdout)?;
    let additional_context = wire
        .hook_specific_output
        .filter(|output| output.hook_event_name == "SessionStart")
        .and_then(|output| output.additional_context);
    Some(SessionStartOutput {
        universal: UniversalOutput::from(wire.universal),
        additional_context,
    })
}

pub(crate) fn parse_stop(stdout: &str) -> Option<StopOutput> {
    let wire: StopWire = parse_json(stdout)?;
    Some(StopOutput {
        universal: UniversalOutput::from(wire.universal),
        should_block: matches!(wire.decision.as_deref(), Some("block")),
        reason: wire.reason,
    })
}

impl From<UniversalWire> for UniversalOutput {
    fn from(value: UniversalWire) -> Self {
        Self {
            continue_processing: value.r#continue,
            stop_reason: value.stop_reason,
            suppress_output: value.suppress_output,
            system_message: value.system_message,
        }
    }
}

fn default_continue() -> bool {
    true
}

fn parse_json<T>(stdout: &str) -> Option<T>
where
    T: for<'de> Deserialize<'de>,
{
    let trimmed = stdout.trim();
    if trimmed.is_empty() {
        return None;
    }
    let value: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    if !value.is_object() {
        return None;
    }
    serde_json::from_value(value).ok()
}
