//! Low-level string-scanning syntax repair primitives for malformed JSON tool arguments.
//!
//! Used by `tool::json_repair::parse_or_repair_tool_args`.

/// Strips ```` ```json ```` and ```` ``` ```` wrapper fences.
pub(crate) fn strip_markdown_fences(s: &str) -> &str {
    let mut cleaned = s.trim();
    if cleaned.starts_with("```") {
        if let Some(first_newline) = cleaned.find('\n') {
            cleaned = &cleaned[first_newline + 1..];
        } else {
            cleaned = cleaned.trim_start_matches('`');
        }
    }
    if cleaned.ends_with("```") {
        cleaned = cleaned.trim_end_matches('`').trim_end();
    }
    cleaned.trim()
}

/// Escapes literal newlines, carriage returns, and unescaped tabs inside string literals.
pub(crate) fn escape_control_chars_in_strings(input: &str) -> String {
    let mut output = String::with_capacity(input.len() + 32);
    let mut in_string = false;
    let mut escape_active = false;

    for ch in input.chars() {
        if escape_active {
            output.push(ch);
            escape_active = false;
            continue;
        }

        if ch == '\\' {
            escape_active = true;
            output.push(ch);
            continue;
        }

        if ch == '"' {
            in_string = !in_string;
            output.push(ch);
            continue;
        }

        if in_string {
            match ch {
                '\n' => output.push_str("\\n"),
                '\r' => output.push_str("\\r"),
                '\t' => output.push_str("\\t"),
                _ => output.push(ch),
            }
        } else {
            output.push(ch);
        }
    }

    output
}

/// Removes trailing commas before `}` or `]`.
pub(crate) fn remove_trailing_commas(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();
    let mut in_string = false;
    let mut escape_active = false;

    let mut i = 0;
    while i < len {
        let ch = chars[i];

        if escape_active {
            output.push(ch);
            escape_active = false;
            i += 1;
            continue;
        }

        if ch == '\\' {
            escape_active = true;
            output.push(ch);
            i += 1;
            continue;
        }

        if ch == '"' {
            in_string = !in_string;
            output.push(ch);
            i += 1;
            continue;
        }

        if !in_string && ch == ',' {
            let mut j = i + 1;
            while j < len && chars[j].is_whitespace() {
                j += 1;
            }
            if j < len && (chars[j] == '}' || chars[j] == ']') {
                i += 1;
                continue;
            }
        }

        output.push(ch);
        i += 1;
    }

    output
}

/// Closes any unclosed string literals and matching braces/brackets.
pub(crate) fn auto_close_json_brackets(input: &str) -> String {
    let mut output = input.to_string();
    let mut in_string = false;
    let mut escape_active = false;
    let mut stack = Vec::new();

    for ch in input.chars() {
        if escape_active {
            escape_active = false;
            continue;
        }
        if ch == '\\' {
            escape_active = true;
            continue;
        }
        if ch == '"' {
            in_string = !in_string;
            continue;
        }
        if !in_string {
            match ch {
                '{' => stack.push('}'),
                '[' => stack.push(']'),
                '}' => {
                    if let Some(pos) = stack.iter().rposition(|&c| c == '}') {
                        stack.remove(pos);
                    }
                }
                ']' => {
                    if let Some(pos) = stack.iter().rposition(|&c| c == ']') {
                        stack.remove(pos);
                    }
                }
                _ => {}
            }
        }
    }

    if in_string {
        output.push('"');
    }

    while let Some(closing) = stack.pop() {
        output.push(closing);
    }

    output
}

/// Simple heuristic to convert single-quoted JSON keys and strings to double-quoted JSON.
pub(crate) fn repair_single_quotes(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut in_double_quote = false;
    let mut in_single_quote = false;
    let mut escape_active = false;

    for ch in input.chars() {
        if escape_active {
            output.push(ch);
            escape_active = false;
            continue;
        }
        if ch == '\\' {
            escape_active = true;
            output.push(ch);
            continue;
        }
        if ch == '"' && !in_single_quote {
            in_double_quote = !in_double_quote;
            output.push(ch);
            continue;
        }
        if ch == '\'' && !in_double_quote {
            in_single_quote = !in_single_quote;
            output.push('"');
            continue;
        }

        output.push(ch);
    }

    output
}

