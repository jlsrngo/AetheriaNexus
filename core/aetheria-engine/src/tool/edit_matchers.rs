//! Fuzzy Block Matchers for Document Edit Tool.
//! Provides cascading candidate matchers (line-trimmed, block-anchor with Levenshtein,
//! whitespace-normalized, indentation-flexible, and trimmed-boundary).

fn levenshtein(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let (m, n) = (a_chars.len(), b_chars.len());
    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }
    let mut dp = vec![vec![0usize; n + 1]; m + 1];
    for (i, row) in dp.iter_mut().enumerate().take(m + 1) {
        row[0] = i;
    }
    for j in 0..=n {
        dp[0][j] = j;
    }
    for i in 1..=m {
        for j in 1..=n {
            let cost = usize::from(a_chars[i - 1] != b_chars[j - 1]);
            dp[i][j] = (dp[i - 1][j] + 1)
                .min(dp[i][j - 1] + 1)
                .min(dp[i - 1][j - 1] + cost);
        }
    }
    dp[m][n]
}

pub(crate) fn line_trimmed_matches(content: &str, find: &str) -> Vec<String> {
    let mut out = Vec::new();
    let orig_lines: Vec<&str> = content.split('\n').collect();
    let mut search_lines: Vec<&str> = find.split('\n').collect();
    if search_lines.last() == Some(&"") {
        search_lines.pop();
    }
    if search_lines.is_empty() || search_lines.len() > orig_lines.len() {
        return out;
    }

    for i in 0..=(orig_lines.len() - search_lines.len()) {
        let mut matches = true;
        for j in 0..search_lines.len() {
            if orig_lines[i + j].trim() != search_lines[j].trim() {
                matches = false;
                break;
            }
        }
        if matches {
            out.push(orig_lines[i..i + search_lines.len()].join("\n"));
        }
    }
    out
}

pub(crate) fn block_anchor_matches(content: &str, find: &str) -> Vec<String> {
    let mut out = Vec::new();
    let orig_lines: Vec<&str> = content.split('\n').collect();
    let mut search_lines: Vec<&str> = find.split('\n').collect();
    if search_lines.last() == Some(&"") {
        search_lines.pop();
    }
    if search_lines.len() < 3 || orig_lines.len() < 3 {
        return out;
    }

    let first_search = search_lines[0].trim();
    let last_search = search_lines[search_lines.len() - 1].trim();
    if first_search.is_empty() || last_search.is_empty() {
        return out;
    }

    let search_block_size = search_lines.len();
    let max_delta = (search_block_size / 4).max(1);

    let mut candidates: Vec<(usize, usize)> = Vec::new();
    for i in 0..orig_lines.len() {
        if orig_lines[i].trim() != first_search {
            continue;
        }
        for j in (i + 2)..orig_lines.len() {
            if orig_lines[j].trim() == last_search {
                let actual_size = j - i + 1;
                if actual_size.abs_diff(search_block_size) <= max_delta {
                    candidates.push((i, j));
                }
                break;
            }
        }
    }

    let mut best_match: Option<(usize, usize)> = None;
    let mut best_sim = -1.0_f64;

    for (start, end) in candidates {
        let actual_size = end - start + 1;
        let lines_to_check = (search_block_size.saturating_sub(2)).min(actual_size.saturating_sub(2));
        let sim = if lines_to_check > 0 {
            let mut acc = 0.0_f64;
            for j in 1..=lines_to_check {
                let orig_l = orig_lines[start + j].trim();
                let search_l = search_lines[j].trim();
                let max_len = orig_l.chars().count().max(search_l.chars().count());
                if max_len == 0 {
                    acc += 1.0;
                } else {
                    let dist = levenshtein(orig_l, search_l);
                    acc += 1.0 - (dist as f64 / max_len as f64);
                }
            }
            acc / (lines_to_check as f64)
        } else {
            1.0
        };

        if sim > best_sim {
            best_sim = sim;
            best_match = Some((start, end));
        }
    }

    if best_sim >= 0.65 {
        if let Some((start, end)) = best_match {
            out.push(orig_lines[start..=end].join("\n"));
        }
    }
    out
}

pub(crate) fn whitespace_normalized_matches(content: &str, find: &str) -> Vec<String> {
    let mut out = Vec::new();
    let norm = |s: &str| s.split_whitespace().collect::<Vec<_>>().join(" ");
    let norm_find = norm(find);
    if norm_find.is_empty() {
        return out;
    }

    let lines: Vec<&str> = content.split('\n').collect();
    let find_lines: Vec<&str> = find.split('\n').collect();

    if find_lines.len() == 1 {
        for line in &lines {
            if norm(line) == norm_find {
                out.push((*line).to_string());
            }
        }
    } else if find_lines.len() <= lines.len() {
        for i in 0..=(lines.len() - find_lines.len()) {
            let block = lines[i..i + find_lines.len()].join("\n");
            if norm(&block) == norm_find {
                out.push(block);
            }
        }
    }
    out
}

pub(crate) fn indentation_flexible_matches(content: &str, find: &str) -> Vec<String> {
    let mut out = Vec::new();
    let strip_indent = |text: &str| -> String {
        let lines: Vec<&str> = text.split('\n').collect();
        let min_indent = lines
            .iter()
            .filter(|l| !l.trim().is_empty())
            .map(|l| l.chars().take_while(|c| c.is_whitespace()).count())
            .min()
            .unwrap_or(0);
        lines
            .iter()
            .map(|l| {
                if l.trim().is_empty() {
                    *l
                } else {
                    let byte_idx = l
                        .char_indices()
                        .nth(min_indent)
                        .map(|(idx, _)| idx)
                        .unwrap_or(l.len());
                    &l[byte_idx..]
                }
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    let norm_find = strip_indent(find);
    let content_lines: Vec<&str> = content.split('\n').collect();
    let find_lines: Vec<&str> = find.split('\n').collect();
    if find_lines.is_empty() || find_lines.len() > content_lines.len() {
        return out;
    }

    for i in 0..=(content_lines.len() - find_lines.len()) {
        let block = content_lines[i..i + find_lines.len()].join("\n");
        if strip_indent(&block) == norm_find {
            out.push(block);
        }
    }
    out
}

pub(crate) fn trimmed_boundary_matches(content: &str, find: &str) -> Vec<String> {
    let mut out = Vec::new();
    let trimmed = find.trim();
    if trimmed == find || trimmed.is_empty() {
        return out;
    }
    if content.contains(trimmed) {
        out.push(trimmed.to_string());
    }
    out
}

