//! Autonomous Operational Tasks & Agenda Board Tool.
//! Manages `.aetheria/tasks.json` in the active workspace via `tasks_store`.

use serde_json::{json, Value};

use super::tasks_store::{
    build_gcal_url, load_tasks, normalize_column, save_tasks_and_notify, task_matches_query,
};

pub fn tasks_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "manage_operational_tasks",
            "description": "Autonomous Executive Assistant tool to manage, schedule, inspect, and update the operational agenda and task checklist (.aetheria/tasks.json). Call this tool whenever the user reports task progress, operational milestones, settlement notes, or requests to schedule meetings, create agenda items, update tasks, or check off checklist items on the tasks board.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["create_task", "complete_subtask", "list", "update_task", "delete_task"],
                        "description": "Action to perform: 'create_task' to schedule/add an agenda item, 'complete_subtask' to check off a subtask, 'list' to view tasks, 'update_task' to modify an existing task, 'delete_task' to remove a task."
                    },
                    "new_task_title": {
                        "type": "string",
                        "description": "Title when creating or updating a task (e.g. 'Ketemu client', 'Rekap transaksi harian', 'Audit invoice supplier')."
                    },
                    "target_date": {
                        "type": "string",
                        "description": "Target execution date in YYYY-MM-DD format (e.g. '2026-10-31'). When user says 'besok' (tomorrow) or 'lusa', calculate the exact date based on Today's date in <env>."
                    },
                    "reminder_time": {
                        "type": "string",
                        "description": "Execution or reminder time in 24-hour HH:mm format (e.g. '13:00' for 1 PM / 1 siang, '09:00' for 9 AM). Defaults to '09:00' if omitted."
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                        "description": "Priority urgency level. Set 'high' if the user mentions 'penting', 'urgent', or 'critical'."
                    },
                    "column": {
                        "type": "string",
                        "enum": ["today", "upcoming", "inprogress", "done"],
                        "description": "Board column. Defaults automatically to 'today' if target_date is today, or 'upcoming' if target_date is in the future."
                    },
                    "notes": {
                        "type": "string",
                        "description": "Optional instructions, meeting agenda, location, or remarks to store with the task."
                    },
                    "task_query": {
                        "type": "string",
                        "description": "Search keyword matching the target task title or description when updating, checking off, or deleting."
                    },
                    "subtask_query": {
                        "type": "string",
                        "description": "Search keyword matching the target subtask checklist title."
                    },
                    "completed": {
                        "type": "boolean",
                        "description": "Whether the subtask checklist is marked completed (true) or pending (false). Defaults to true."
                    }
                },
                "required": ["action"]
            }
        }
    })
}

pub fn execute_manage_tasks(
    _session_id: &str,
    workspace_dir: &str,
    arguments: &Value,
) -> Value {
    let action = arguments
        .get("action")
        .and_then(|v| v.as_str())
        .unwrap_or("list");
    let task_query = arguments
        .get("task_query")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    let subtask_query = arguments
        .get("subtask_query")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    let mark_completed = arguments
        .get("completed")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let target_column = arguments.get("column").and_then(|v| v.as_str());
    let notes = arguments
        .get("notes")
        .or_else(|| arguments.get("description"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let mut tasks = load_tasks(workspace_dir);

    match action {
        "create_task" => create_task_action(
            workspace_dir,
            &mut tasks,
            arguments,
            target_column,
            notes,
            &subtask_query,
            mark_completed,
        ),
        "complete_subtask" => complete_subtask_action(
            workspace_dir,
            &mut tasks,
            &task_query,
            &subtask_query,
            mark_completed,
            target_column,
            notes,
        ),
        "update_task" => update_task_action(
            workspace_dir,
            &mut tasks,
            arguments,
            &task_query,
            target_column,
            notes,
        ),
        "delete_task" => delete_task_action(workspace_dir, &mut tasks, &task_query),
        _ => json!({
            "status": "success",
            "totalTasks": tasks.len(),
            "tasks": tasks,
            "output": format!("Retrieved {} operational agenda items from board.", tasks.len())
        }),
    }
}

fn epoch_ms_now() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn create_task_action(
    workspace_dir: &str,
    tasks: &mut Vec<Value>,
    arguments: &Value,
    target_column: Option<&str>,
    notes: &str,
    subtask_query: &str,
    mark_completed: bool,
) -> Value {
    let new_title = arguments
        .get("new_task_title")
        .or_else(|| arguments.get("title"))
        .and_then(|v| v.as_str())
        .unwrap_or("New Operational Task");
    let now = chrono::Local::now();
    let today_date_str = now.format("%Y-%m-%d").to_string();
    let target_date = arguments
        .get("target_date")
        .or_else(|| arguments.get("date"))
        .and_then(|v| v.as_str())
        .unwrap_or(&today_date_str);
    let reminder_time = arguments
        .get("reminder_time")
        .or_else(|| arguments.get("time"))
        .and_then(|v| v.as_str())
        .unwrap_or("09:00");
    let priority = arguments
        .get("priority")
        .and_then(|v| v.as_str())
        .unwrap_or("medium");

    let computed_col = if let Some(c) = target_column {
        normalize_column(c)
    } else if target_date > today_date_str.as_str() {
        "upcoming"
    } else {
        "today"
    };

    let now_iso = now.to_rfc3339();
    let ts_id = epoch_ms_now();
    let new_task = json!({
        "id": format!("task_{}", ts_id),
        "title": new_title,
        "description": notes,
        "columnId": computed_col,
        "targetDate": target_date,
        "reminderTime": reminder_time,
        "reminderDateTime": format!("{}T{}:00", target_date, reminder_time),
        "telegramReminderEnabled": true,
        "notifiedAt": Value::Null,
        "priority": priority,
        "attachedFile": "",
        "gcalUrl": build_gcal_url(new_title, target_date, reminder_time, notes, priority),
        "subtasks": if !subtask_query.is_empty() {
            vec![json!({
                "id": format!("st_{}", ts_id),
                "title": subtask_query,
                "completed": mark_completed
            })]
        } else {
            vec![]
        },
        "createdAt": now_iso,
        "updatedAt": now_iso
    });

    tasks.insert(0, new_task);
    save_tasks_and_notify(workspace_dir, tasks, json!({ "tasks": tasks }));

    json!({
        "status": "success",
        "title": new_title,
        "targetDate": target_date,
        "reminderTime": reminder_time,
        "priority": priority,
        "columnId": computed_col,
        "output": format!("Created new operational agenda item '{}' scheduled for {} at {} (Priority: {}) in column '{}'.", new_title, target_date, reminder_time, priority, computed_col)
    })
}

fn complete_subtask_action(
    workspace_dir: &str,
    tasks: &mut Vec<Value>,
    task_query: &str,
    subtask_query: &str,
    mark_completed: bool,
    target_column: Option<&str>,
    notes: &str,
) -> Value {
    let mut matched_task_title = String::new();
    let mut matched_subtask_title = String::new();
    let mut found_task = false;
    let mut found_subtask = false;

    for task in tasks.iter_mut() {
        if !task_matches_query(task, task_query, true) {
            continue;
        }
        found_task = true;
        matched_task_title = task
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if let Some(subtasks) = task.get_mut("subtasks").and_then(|v| v.as_array_mut()) {
            for st in subtasks.iter_mut() {
                let st_title = st
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_lowercase();
                if subtask_query.is_empty()
                    || st_title.contains(subtask_query)
                    || subtask_query.contains(&st_title)
                {
                    st["completed"] = json!(mark_completed);
                    matched_subtask_title = st
                        .get("title")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    found_subtask = true;
                    break;
                }
            }

            if !found_subtask && !subtask_query.is_empty() {
                subtasks.push(json!({
                    "id": format!("st_{}", epoch_ms_now()),
                    "title": subtask_query,
                    "completed": mark_completed
                }));
                matched_subtask_title = subtask_query.to_string();
            }

            let all_done = !subtasks.is_empty()
                && subtasks
                    .iter()
                    .all(|st| st.get("completed").and_then(|v| v.as_bool()).unwrap_or(false));
            if all_done {
                task["columnId"] = json!("done");
            } else if let Some(col) = target_column {
                task["columnId"] = json!(normalize_column(col));
            }
        }

        if !notes.is_empty() {
            let prev_desc = task
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let new_desc = if prev_desc.is_empty() {
                notes.to_string()
            } else {
                format!("{}\n[Assistant Note]: {}", prev_desc, notes)
            };
            task["description"] = json!(new_desc);
        }

        task["updatedAt"] = json!(chrono::Local::now().to_rfc3339());
        break;
    }

    if !found_task {
        return json!({
            "status": "not_found",
            "output": format!("No operational agenda item found matching query '{}'. Currently {} tasks on board.", task_query, tasks.len()),
            "tasks": tasks
        });
    }

    save_tasks_and_notify(
        workspace_dir,
        tasks,
        json!({
            "tasks": tasks,
            "updatedTask": matched_task_title,
            "checkedSubtask": matched_subtask_title
        }),
    );

    json!({
        "status": "success",
        "taskTitle": matched_task_title,
        "subtaskTitle": matched_subtask_title,
        "completed": mark_completed,
        "notes": notes,
        "output": format!(
            "Successfully marked subtask '{}' on agenda '{}' as completed. Notes: {}.",
            matched_subtask_title,
            matched_task_title,
            if notes.is_empty() { "None" } else { notes }
        )
    })
}

fn update_task_action(
    workspace_dir: &str,
    tasks: &mut Vec<Value>,
    arguments: &Value,
    task_query: &str,
    target_column: Option<&str>,
    notes: &str,
) -> Value {
    let mut found_task = false;
    let mut matched_title = String::new();

    for task in tasks.iter_mut() {
        if !task_matches_query(task, task_query, false) {
            continue;
        }
        found_task = true;
        if let Some(new_title) = arguments
            .get("new_task_title")
            .or_else(|| arguments.get("title"))
            .and_then(|v| v.as_str())
        {
            task["title"] = json!(new_title);
        }
        if let Some(t_date) = arguments
            .get("target_date")
            .or_else(|| arguments.get("date"))
            .and_then(|v| v.as_str())
        {
            task["targetDate"] = json!(t_date);
        }
        if let Some(r_time) = arguments
            .get("reminder_time")
            .or_else(|| arguments.get("time"))
            .and_then(|v| v.as_str())
        {
            task["reminderTime"] = json!(r_time);
            let t_date = task
                .get("targetDate")
                .and_then(|v| v.as_str())
                .unwrap_or("2026-10-30");
            task["reminderDateTime"] = json!(format!("{}T{}:00", t_date, r_time));
            task["notifiedAt"] = Value::Null;
        }
        if let Some(prio) = arguments.get("priority").and_then(|v| v.as_str()) {
            task["priority"] = json!(prio);
        }
        if let Some(col) = target_column {
            task["columnId"] = json!(normalize_column(col));
        }
        if !notes.is_empty() {
            let prev_desc = task
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let new_desc = if prev_desc.is_empty() {
                notes.to_string()
            } else {
                format!("{}\n{}", prev_desc, notes)
            };
            task["description"] = json!(new_desc);
        }
        task["updatedAt"] = json!(chrono::Local::now().to_rfc3339());
        matched_title = task
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        break;
    }

    if !found_task {
        return json!({
            "status": "not_found",
            "output": format!("No operational agenda item found matching query '{}'.", task_query),
        });
    }

    save_tasks_and_notify(workspace_dir, tasks, json!({ "tasks": tasks }));

    json!({
        "status": "success",
        "output": format!("Successfully updated agenda item '{}'.", matched_title)
    })
}

fn delete_task_action(
    workspace_dir: &str,
    tasks: &mut Vec<Value>,
    task_query: &str,
) -> Value {
    let initial_len = tasks.len();
    let mut removed_title = String::new();

    tasks.retain(|task| {
        if task_matches_query(task, task_query, false) && removed_title.is_empty() {
            removed_title = task
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            false
        } else {
            true
        }
    });

    if tasks.len() == initial_len {
        return json!({
            "status": "not_found",
            "output": format!("No operational agenda item found matching query '{}'.", task_query),
        });
    }

    save_tasks_and_notify(workspace_dir, tasks, json!({ "tasks": tasks }));

    json!({
        "status": "success",
        "output": format!("Successfully deleted agenda item '{}' from board.", removed_title)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_create_and_manage_operational_task() {
        let tmp = std::env::temp_dir().join(format!("test_aetheria_tasks_{}", epoch_ms_now()));
        let _ = fs::create_dir_all(&tmp);
        let ws = tmp.to_str().unwrap();

        let create_args = json!({
            "action": "create_task",
            "new_task_title": "Ketemu client",
            "target_date": "2099-12-31",
            "reminder_time": "13:00",
            "priority": "high",
            "notes": "Pertemuan di kantor client membahas kontrak"
        });
        let res = execute_manage_tasks("s1", ws, &create_args);
        assert_eq!(res["status"], "success");
        assert_eq!(res["title"], "Ketemu client");
        assert_eq!(res["priority"], "high");
        assert_eq!(res["reminderTime"], "13:00");
        assert_eq!(res["targetDate"], "2099-12-31");
        assert_eq!(res["columnId"], "upcoming");

        let list_res = execute_manage_tasks("s1", ws, &json!({ "action": "list" }));
        assert_eq!(list_res["totalTasks"], 1);

        let update_res = execute_manage_tasks(
            "s1",
            ws,
            &json!({ "action": "update_task", "task_query": "Ketemu client", "reminder_time": "15:00" }),
        );
        assert_eq!(update_res["status"], "success");

        let del_res = execute_manage_tasks(
            "s1",
            ws,
            &json!({ "action": "delete_task", "task_query": "Ketemu client" }),
        );
        assert_eq!(del_res["status"], "success");

        let list_res_after = execute_manage_tasks("s1", ws, &json!({ "action": "list" }));
        assert_eq!(list_res_after["totalTasks"], 0);

        let _ = fs::remove_dir_all(&tmp);
    }
}
