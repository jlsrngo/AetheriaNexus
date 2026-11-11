//! Administrative Document Classifier for Folder Watcher.
//!
//! Classifies detected workspace documents by filename & extension into domain categories
//! (`INVOICE`, `BANK_STATEMENT`, `RECEIPT`, `CONTRACT`, `LEDGER_SPREADSHEET`, `GENERAL_DOCUMENT`).

use crate::paths::now_ms;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Administrative document classification for newly ingested files.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DetectedDocument {
    pub filename: String,
    pub path: String,
    pub extension: String,
    pub category: String,
    pub size_bytes: u64,
    pub detected_at_ms: u64,
    pub recommended_action: String,
    pub suggested_playbook_id: String,
}

const INTERNAL_DELIVERABLES: &[&str] = &[
    "daily_cash_recap.xlsx",
    "daily_cash_closing_memo.docx",
    "accounts_payable_ledger.xlsx",
    "payment_approval_voucher.docx",
    "document_archive_index.xlsx",
    "monthly_governance_report.docx",
    "reconciliation_audit_report.xlsx",
    "reconciliation_discrepancy_memo.docx",
    "executive_summary_memo.docx",
    "executive_presentation_deck.pptx",
];

pub(crate) fn is_supported_document_ext(ext: &str) -> bool {
    matches!(
        ext,
        "pdf" | "xlsx" | "xls" | "csv" | "docx" | "doc" | "pptx" | "txt" | "md" | "png" | "jpg" | "jpeg" | "webp"
    )
}

pub(crate) fn is_internal_deliverable(filename: &str) -> bool {
    let lower = filename.to_ascii_lowercase();
    INTERNAL_DELIVERABLES.iter().any(|&d| d == lower)
}

/// Classifies a newly detected file based on filename semantics and extension.
pub fn classify_document(filename: &str, full_path: &str, size_bytes: u64) -> DetectedDocument {
    let lower = filename.to_ascii_lowercase();
    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let (category, recommended_action, suggested_playbook_id) = if lower.contains("inv")
        || lower.contains("invoice")
        || lower.contains("bill")
        || lower.contains("vendor")
        || lower.contains("supplier")
        || lower.contains("po_")
        || lower.contains("po-")
    {
        (
            "INVOICE",
            "Extract line items, cross-check against Purchase Orders, and update Accounts Payable ledger",
            "supplier_invoice_verification",
        )
    } else if lower.contains("bank")
        || lower.contains("statement")
        || lower.contains("mutation")
        || lower.contains("settlement")
    {
        (
            "BANK_STATEMENT",
            "Run 3-Way Cash & Bank Reconciliation against store shift totals and Excel cashbook",
            "daily_cash_closing",
        )
    } else if lower.contains("receipt")
        || lower.contains("slip")
        || lower.contains("pos")
        || lower.contains("register")
        || lower.contains("voucher")
        || matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp")
    {
        (
            "RECEIPT",
            "Verify payment proof and reconcile with daily cash register closing",
            "daily_cash_closing",
        )
    } else if lower.contains("contract")
        || lower.contains("agreement")
        || lower.contains("policy")
        || lower.contains("memo")
        || ext == "docx"
        || ext == "doc"
    {
        (
            "CONTRACT",
            "Catalog document metadata and index in Monthly Administrative Archive",
            "monthly_administrative_archive",
        )
    } else if matches!(ext.as_str(), "xlsx" | "xls" | "csv") {
        (
            "LEDGER_SPREADSHEET",
            "Audit spreadsheet formulas and cross-reconcile financial totals",
            "daily_cash_closing",
        )
    } else {
        (
            "GENERAL_DOCUMENT",
            "Inspect document contents and index into project governance archive",
            "monthly_administrative_archive",
        )
    };

    DetectedDocument {
        filename: filename.to_string(),
        path: full_path.replace('\\', "/"),
        extension: ext,
        category: category.to_string(),
        size_bytes,
        detected_at_ms: now_ms(),
        recommended_action: recommended_action.to_string(),
        suggested_playbook_id: suggested_playbook_id.to_string(),
    }
}

