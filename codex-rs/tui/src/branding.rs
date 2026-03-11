use std::sync::OnceLock;

const JASPER_PLACEHOLDERS: [&str; 8] = [
    "Welcome, I am Jasper. What needs attention?",
    "Review household priorities for today",
    "Draft a follow-up for @contact",
    "Summarize what changed since yesterday",
    "Find the next operational risk",
    "Prepare a concise action plan",
    "Review the current workspace carefully",
    "Surface what needs a reply first",
];

const DEFAULT_PLACEHOLDERS: [&str; 8] = [
    "Explain this codebase",
    "Summarize recent commits",
    "Implement {feature}",
    "Find and fix a bug in @filename",
    "Write tests for @filename",
    "Improve documentation in @filename",
    "Run /review on my current changes",
    "Use /skills to list available skills",
];

static JASPER_BRANDED: OnceLock<bool> = OnceLock::new();

pub(crate) fn is_jasper_branded() -> bool {
    *JASPER_BRANDED.get_or_init(|| {
        std::env::var("JASPER_BRANDED")
            .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "enabled"))
            .unwrap_or(false)
    })
}

pub(crate) fn app_title() -> &'static str {
    if is_jasper_branded() {
        "Jasper // Household Intelligence"
    } else {
        "OpenAI Codex"
    }
}

pub(crate) fn short_agent_name() -> &'static str {
    if is_jasper_branded() {
        "Jasper"
    } else {
        "Codex"
    }
}

pub(crate) fn welcome_message() -> (&'static str, &'static str) {
    if is_jasper_branded() {
        ("Welcome, I am", "Your household intelligence system.")
    } else {
        ("Welcome to", "OpenAI's command-line coding agent")
    }
}

pub(crate) fn placeholder_samples() -> &'static [&'static str] {
    if is_jasper_branded() {
        &JASPER_PLACEHOLDERS
    } else {
        &DEFAULT_PLACEHOLDERS
    }
}

pub(crate) fn personality_subtitle() -> &'static str {
    if is_jasper_branded() {
        "Choose how Jasper should sound."
    } else {
        "Choose a communication style for Codex."
    }
}

pub(crate) fn settings_subtitle() -> &'static str {
    if is_jasper_branded() {
        "Configure settings for Jasper."
    } else {
        "Configure settings for Codex."
    }
}

pub(crate) fn approval_abort_label() -> &'static str {
    if is_jasper_branded() {
        "No, and tell Jasper what to do differently"
    } else {
        "No, and tell Codex what to do differently"
    }
}

pub(crate) fn auth_pick_mode_line() -> &'static str {
    if is_jasper_branded() {
        "Sign in with ChatGPT to use Jasper as part of your paid plan"
    } else {
        "Sign in with ChatGPT to use Codex as part of your paid plan"
    }
}

pub(crate) fn autonomy_line() -> &'static str {
    if is_jasper_branded() {
        "  Decide how much autonomy you want to grant Jasper"
    } else {
        "  Decide how much autonomy you want to grant Codex"
    }
}

pub(crate) fn docs_label() -> &'static str {
    if is_jasper_branded() {
        "Jasper docs"
    } else {
        "Codex docs"
    }
}

pub(crate) fn mistakes_line() -> &'static str {
    if is_jasper_branded() {
        "  Jasper can make mistakes"
    } else {
        "  Codex can make mistakes"
    }
}

pub(crate) fn status_note_lines() -> Vec<&'static str> {
    if is_jasper_branded() {
        vec![
            "Jasper usage depends on your active provider and account settings.",
            "Check your provider settings for current rate limits and credits.",
        ]
    } else {
        vec![
            "Visit https://chatgpt.com/codex/settings/usage for up-to-date",
            "information on rate limits and credits",
        ]
    }
}

pub(crate) fn startup_tooltip() -> Option<String> {
    if is_jasper_branded() {
        Some("Jasper is online. Start with priorities, follow-ups, or review.".to_string())
    } else {
        None
    }
}
