use crate::config::app_data_dir;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::PathBuf, time::UNIX_EPOCH};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SyncProjectIndexRequest {
    #[serde(default)]
    pub(crate) project_path: String,
    pub(crate) payload: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectIndexSummary {
    pub(crate) db_path: String,
    pub(crate) project_path: String,
    pub(crate) updated_at: u64,
    pub(crate) node_count: u64,
    pub(crate) shot_count: u64,
    pub(crate) timeline_clip_count: u64,
    pub(crate) resource_count: u64,
    pub(crate) task_count: u64,
    pub(crate) media_count: u64,
    pub(crate) referenced_media_count: u64,
    pub(crate) orphan_media_count: u64,
    pub(crate) media_reference_count: u64,
    pub(crate) delete_audit_count: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SearchProjectIndexRequest {
    #[serde(default)]
    pub(crate) query: String,
    #[serde(default = "default_search_limit")]
    pub(crate) limit: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectIndexSearchItem {
    pub(crate) kind: String,
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) subtitle: String,
    pub(crate) path: String,
    pub(crate) size: u64,
    pub(crate) referenced: bool,
    pub(crate) raw_json: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectIndexSearchResponse {
    pub(crate) query: String,
    pub(crate) items: Vec<ProjectIndexSearchItem>,
}

pub(crate) fn sync_project_index(
    request: SyncProjectIndexRequest,
) -> Result<ProjectIndexSummary, String> {
    let path = index_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let mut conn = Connection::open(&path).map_err(|err| err.to_string())?;
    ensure_schema(&conn)?;
    let tx = conn.transaction().map_err(|err| err.to_string())?;
    let updated_at = current_timestamp();
    let payload_json = serde_json::to_string(&request.payload).map_err(|err| err.to_string())?;

    tx.execute(
        "insert into project_snapshots (id, project_path, updated_at, payload_json)
         values (1, ?1, ?2, ?3)
         on conflict(id) do update set project_path = excluded.project_path, updated_at = excluded.updated_at, payload_json = excluded.payload_json",
        params![request.project_path, updated_at, payload_json],
    )
    .map_err(|err| err.to_string())?;

    tx.execute("delete from node_index", []).map_err(|err| err.to_string())?;
    for item in value_array(&request.payload, "nodes") {
        tx.execute(
            "insert or replace into node_index (id, type, title, episode_id, x, y, text, raw_json)
             values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                value_string(item, "id"),
                value_string(item, "type"),
                value_string(item, "title"),
                value_string(item, "episodeId"),
                value_u64(item, "x"),
                value_u64(item, "y"),
                value_string(item, "text"),
                serde_json::to_string(item).map_err(|err| err.to_string())?,
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.execute("delete from shot_index", []).map_err(|err| err.to_string())?;
    for item in value_array(&request.payload, "shots") {
        let id = value_string(item, "id");
        let source_node_id = value_string(item, "sourceNodeId");
        tx.execute(
            "insert or replace into shot_index (id, source_node_id, episode_id, scene, title, status, action, image_prompt, video_prompt, raw_json)
             values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                format!("{source_node_id}::{id}"),
                source_node_id,
                value_string(item, "episodeId"),
                value_string(item, "scene"),
                value_string(item, "title"),
                value_string(item, "status"),
                value_string(item, "action"),
                value_string(item, "imagePrompt"),
                value_string(item, "videoPrompt"),
                serde_json::to_string(item).map_err(|err| err.to_string())?,
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.execute("delete from timeline_clip_index", []).map_err(|err| err.to_string())?;
    for item in value_array(&request.payload, "timelineClips") {
        tx.execute(
            "insert or replace into timeline_clip_index (id, episode_id, source_node_id, shot_id, title, scene, duration, approval_status, media_url, subtitle, raw_json)
             values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                value_string(item, "id"),
                value_string(item, "episodeId"),
                value_string(item, "sourceNodeId"),
                value_string(item, "shotId"),
                value_string(item, "title"),
                value_string(item, "scene"),
                value_string(item, "duration"),
                value_string(item, "approvalStatus"),
                value_string(item, "mediaUrl"),
                value_string(item, "subtitle"),
                serde_json::to_string(item).map_err(|err| err.to_string())?,
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.execute("delete from resource_index", []).map_err(|err| err.to_string())?;
    for item in value_array(&request.payload, "resources") {
        tx.execute(
            "insert or replace into resource_index (id, name, kind, token, episode_id, file_path, thumbnail_path, updated_at, raw_json)
             values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                value_string(item, "id"),
                value_string(item, "name"),
                value_string(item, "kind"),
                value_string(item, "token"),
                value_string(item, "episodeId"),
                value_string(item, "filePath"),
                value_string(item, "thumbnailPath"),
                value_u64(item, "updatedAt"),
                serde_json::to_string(item).map_err(|err| err.to_string())?,
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.execute("delete from task_index", []).map_err(|err| err.to_string())?;
    for item in value_array(&request.payload, "tasks") {
        tx.execute(
            "insert or replace into task_index (id, kind, status, episode_id, node_id, updated_at, raw_json)
             values (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                value_string(item, "id"),
                value_string(item, "kind"),
                value_string(item, "status"),
                value_string(item, "episodeId"),
                value_string(item, "nodeId"),
                value_u64(item, "updatedAt"),
                serde_json::to_string(item).map_err(|err| err.to_string())?,
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.execute("delete from media_index", []).map_err(|err| err.to_string())?;
    tx.execute("delete from media_reference_index", []).map_err(|err| err.to_string())?;
    for item in value_array(&request.payload, "mediaFiles") {
        let path = value_string(item, "path");
        tx.execute(
            "insert or replace into media_index (path, file_name, size, is_thumbnail, referenced, review_decision, raw_json)
             values (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                path,
                value_string(item, "fileName"),
                value_u64(item, "size"),
                value_bool(item, "isThumbnail"),
                value_bool(item, "referenced"),
                value_string(item, "reviewDecision"),
                serde_json::to_string(item).map_err(|err| err.to_string())?,
            ],
        )
        .map_err(|err| err.to_string())?;
        for reference in value_array(item, "references") {
            tx.execute(
                "insert into media_reference_index (media_path, source_path, value) values (?1, ?2, ?3)",
                params![path, value_string(reference, "path"), value_string(reference, "value")],
            )
            .map_err(|err| err.to_string())?;
        }
    }

    tx.execute("delete from delete_audit_index", []).map_err(|err| err.to_string())?;
    for item in value_array(&request.payload, "deletionAudit") {
        tx.execute(
            "insert into delete_audit_index (deleted_at, raw_json) values (?1, ?2)",
            params![value_string(item, "deletedAt"), serde_json::to_string(item).map_err(|err| err.to_string())?],
        )
        .map_err(|err| err.to_string())?;
    }

    tx.commit().map_err(|err| err.to_string())?;
    read_project_index_summary()
}

pub(crate) fn read_project_index_summary() -> Result<ProjectIndexSummary, String> {
    let path = index_path()?;
    if !path.exists() {
        return Ok(ProjectIndexSummary {
            db_path: path.to_string_lossy().to_string(),
            project_path: String::new(),
            updated_at: 0,
            node_count: 0,
            shot_count: 0,
            timeline_clip_count: 0,
            resource_count: 0,
            task_count: 0,
            media_count: 0,
            referenced_media_count: 0,
            orphan_media_count: 0,
            media_reference_count: 0,
            delete_audit_count: 0,
        });
    }
    let conn = Connection::open(&path).map_err(|err| err.to_string())?;
    ensure_schema(&conn)?;
    let (project_path, updated_at): (String, u64) = conn
        .query_row(
            "select project_path, updated_at from project_snapshots where id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or_default();
    Ok(ProjectIndexSummary {
        db_path: path.to_string_lossy().to_string(),
        project_path,
        updated_at,
        node_count: count(&conn, "node_index")?,
        shot_count: count(&conn, "shot_index")?,
        timeline_clip_count: count(&conn, "timeline_clip_index")?,
        resource_count: count(&conn, "resource_index")?,
        task_count: count(&conn, "task_index")?,
        media_count: count(&conn, "media_index")?,
        referenced_media_count: count_where(&conn, "media_index", "referenced = 1")?,
        orphan_media_count: count_where(&conn, "media_index", "referenced = 0")?,
        media_reference_count: count(&conn, "media_reference_index")?,
        delete_audit_count: count(&conn, "delete_audit_index")?,
    })
}

pub(crate) fn search_project_index(
    request: SearchProjectIndexRequest,
) -> Result<ProjectIndexSearchResponse, String> {
    let path = index_path()?;
    if !path.exists() {
        return Ok(ProjectIndexSearchResponse {
            query: request.query,
            items: Vec::new(),
        });
    }
    let conn = Connection::open(&path).map_err(|err| err.to_string())?;
    ensure_schema(&conn)?;
    let keyword = request.query.trim().to_lowercase();
    let pattern = format!("%{}%", keyword.replace('%', "\\%").replace('_', "\\_"));
    let limit = request.limit.clamp(1, 100);
    let mut items = Vec::new();
    search_nodes(&conn, &keyword, &pattern, limit, &mut items)?;
    search_shots(&conn, &keyword, &pattern, limit, &mut items)?;
    search_timeline_clips(&conn, &keyword, &pattern, limit, &mut items)?;
    search_resources(&conn, &keyword, &pattern, limit, &mut items)?;
    search_tasks(&conn, &keyword, &pattern, limit, &mut items)?;
    search_media(&conn, &keyword, &pattern, limit, &mut items)?;
    search_media_references(&conn, &keyword, &pattern, limit, &mut items)?;
    items.truncate(limit as usize);
    Ok(ProjectIndexSearchResponse {
        query: request.query,
        items,
    })
}

fn ensure_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        create table if not exists project_snapshots (
            id integer primary key check (id = 1),
            project_path text not null,
            updated_at integer not null,
            payload_json text not null
        );
        create table if not exists node_index (
            id text primary key,
            type text not null,
            title text not null,
            episode_id text not null,
            x integer not null,
            y integer not null,
            text text not null,
            raw_json text not null
        );
        create table if not exists shot_index (
            id text primary key,
            source_node_id text not null,
            episode_id text not null,
            scene text not null,
            title text not null,
            status text not null,
            action text not null,
            image_prompt text not null,
            video_prompt text not null,
            raw_json text not null
        );
        create table if not exists timeline_clip_index (
            id text primary key,
            episode_id text not null,
            source_node_id text not null,
            shot_id text not null,
            title text not null,
            scene text not null,
            duration text not null,
            approval_status text not null,
            media_url text not null,
            subtitle text not null,
            raw_json text not null
        );
        create table if not exists resource_index (
            id text primary key,
            name text not null,
            kind text not null,
            token text not null,
            episode_id text not null,
            file_path text not null,
            thumbnail_path text not null,
            updated_at integer not null,
            raw_json text not null
        );
        create table if not exists task_index (
            id text primary key,
            kind text not null,
            status text not null,
            episode_id text not null,
            node_id text not null,
            updated_at integer not null,
            raw_json text not null
        );
        create table if not exists media_index (
            path text primary key,
            file_name text not null,
            size integer not null,
            is_thumbnail integer not null,
            referenced integer not null,
            review_decision text not null,
            raw_json text not null
        );
        create table if not exists media_reference_index (
            id integer primary key autoincrement,
            media_path text not null,
            source_path text not null,
            value text not null
        );
        create index if not exists media_reference_path_idx on media_reference_index(media_path);
        create table if not exists delete_audit_index (
            id integer primary key autoincrement,
            deleted_at text not null,
            raw_json text not null
        );
        ",
    )
    .map_err(|err| err.to_string())
}

fn search_nodes(
    conn: &Connection,
    keyword: &str,
    pattern: &str,
    limit: u64,
    items: &mut Vec<ProjectIndexSearchItem>,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "select id, type, title, episode_id, text, raw_json
             from node_index
             where ?1 = '' or lower(id) like ?2 escape '\\' or lower(type) like ?2 escape '\\' or lower(title) like ?2 escape '\\' or lower(text) like ?2 escape '\\'
             limit ?3",
        )
        .map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map(params![keyword, pattern, limit], |row| {
            let id: String = row.get(0)?;
            let node_type: String = row.get(1)?;
            let title: String = row.get(2)?;
            let episode_id: String = row.get(3)?;
            let text: String = row.get(4)?;
            let raw_json: String = row.get(5)?;
            Ok(ProjectIndexSearchItem {
                kind: "node".to_string(),
                id: id.clone(),
                title: if title.is_empty() { id.clone() } else { title },
                subtitle: format!("{} · {} · {}", node_type, episode_id, text),
                path: id,
                size: 0,
                referenced: true,
                raw_json,
            })
        })
        .map_err(|err| err.to_string())?;
    collect_rows(rows, items)
}

fn search_shots(
    conn: &Connection,
    keyword: &str,
    pattern: &str,
    limit: u64,
    items: &mut Vec<ProjectIndexSearchItem>,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "select id, source_node_id, episode_id, scene, title, status, action, image_prompt, video_prompt, raw_json
             from shot_index
             where ?1 = '' or lower(id) like ?2 escape '\\' or lower(scene) like ?2 escape '\\' or lower(title) like ?2 escape '\\' or lower(action) like ?2 escape '\\' or lower(image_prompt) like ?2 escape '\\' or lower(video_prompt) like ?2 escape '\\'
             limit ?3",
        )
        .map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map(params![keyword, pattern, limit], |row| {
            let id: String = row.get(0)?;
            let source_node_id: String = row.get(1)?;
            let episode_id: String = row.get(2)?;
            let scene: String = row.get(3)?;
            let title: String = row.get(4)?;
            let status: String = row.get(5)?;
            let action: String = row.get(6)?;
            let image_prompt: String = row.get(7)?;
            let video_prompt: String = row.get(8)?;
            let raw_json: String = row.get(9)?;
            Ok(ProjectIndexSearchItem {
                kind: "shot".to_string(),
                id,
                title: if title.is_empty() { scene.clone() } else { title },
                subtitle: format!("{} · {} · {} · {} {} {}", episode_id, scene, status, action, image_prompt, video_prompt),
                path: source_node_id,
                size: 0,
                referenced: true,
                raw_json,
            })
        })
        .map_err(|err| err.to_string())?;
    collect_rows(rows, items)
}

fn search_timeline_clips(
    conn: &Connection,
    keyword: &str,
    pattern: &str,
    limit: u64,
    items: &mut Vec<ProjectIndexSearchItem>,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "select id, episode_id, source_node_id, shot_id, title, scene, duration, approval_status, media_url, subtitle, raw_json
             from timeline_clip_index
             where ?1 = '' or lower(id) like ?2 escape '\\' or lower(shot_id) like ?2 escape '\\' or lower(title) like ?2 escape '\\' or lower(scene) like ?2 escape '\\' or lower(media_url) like ?2 escape '\\' or lower(subtitle) like ?2 escape '\\'
             limit ?3",
        )
        .map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map(params![keyword, pattern, limit], |row| {
            let id: String = row.get(0)?;
            let episode_id: String = row.get(1)?;
            let source_node_id: String = row.get(2)?;
            let shot_id: String = row.get(3)?;
            let title: String = row.get(4)?;
            let scene: String = row.get(5)?;
            let duration: String = row.get(6)?;
            let approval_status: String = row.get(7)?;
            let media_url: String = row.get(8)?;
            let subtitle: String = row.get(9)?;
            let raw_json: String = row.get(10)?;
            Ok(ProjectIndexSearchItem {
                kind: "timelineClip".to_string(),
                id: id.clone(),
                title: if title.is_empty() { shot_id.clone() } else { title },
                subtitle: format!("{} · {} · {} · {} · {} · {}", episode_id, scene, duration, approval_status, media_url, subtitle),
                path: source_node_id,
                size: 0,
                referenced: true,
                raw_json,
            })
        })
        .map_err(|err| err.to_string())?;
    collect_rows(rows, items)
}

fn search_resources(
    conn: &Connection,
    keyword: &str,
    pattern: &str,
    limit: u64,
    items: &mut Vec<ProjectIndexSearchItem>,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "select id, name, kind, token, episode_id, file_path, raw_json
             from resource_index
             where ?1 = '' or lower(name) like ?2 escape '\\' or lower(token) like ?2 escape '\\' or lower(kind) like ?2 escape '\\' or lower(file_path) like ?2 escape '\\'
             order by updated_at desc
             limit ?3",
        )
        .map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map(params![keyword, pattern, limit], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let kind: String = row.get(2)?;
            let token: String = row.get(3)?;
            let episode_id: String = row.get(4)?;
            let path: String = row.get(5)?;
            let raw_json: String = row.get(6)?;
            Ok(ProjectIndexSearchItem {
                kind: "resource".to_string(),
                id,
                title: if name.is_empty() { token.clone() } else { name },
                subtitle: format!("{} · {} · {}", kind, token, episode_id),
                path,
                size: 0,
                referenced: true,
                raw_json,
            })
        })
        .map_err(|err| err.to_string())?;
    collect_rows(rows, items)
}

fn search_tasks(
    conn: &Connection,
    keyword: &str,
    pattern: &str,
    limit: u64,
    items: &mut Vec<ProjectIndexSearchItem>,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "select id, kind, status, episode_id, node_id, raw_json
             from task_index
             where ?1 = '' or lower(id) like ?2 escape '\\' or lower(kind) like ?2 escape '\\' or lower(status) like ?2 escape '\\' or lower(node_id) like ?2 escape '\\'
             order by updated_at desc
             limit ?3",
        )
        .map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map(params![keyword, pattern, limit], |row| {
            let id: String = row.get(0)?;
            let kind: String = row.get(1)?;
            let status: String = row.get(2)?;
            let episode_id: String = row.get(3)?;
            let node_id: String = row.get(4)?;
            let raw_json: String = row.get(5)?;
            Ok(ProjectIndexSearchItem {
                kind: "task".to_string(),
                id: id.clone(),
                title: id,
                subtitle: format!("{} · {} · {} · {}", kind, status, episode_id, node_id),
                path: node_id,
                size: 0,
                referenced: true,
                raw_json,
            })
        })
        .map_err(|err| err.to_string())?;
    collect_rows(rows, items)
}

fn search_media(
    conn: &Connection,
    keyword: &str,
    pattern: &str,
    limit: u64,
    items: &mut Vec<ProjectIndexSearchItem>,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "select path, file_name, size, referenced, review_decision, raw_json
             from media_index
             where ?1 = '' or lower(path) like ?2 escape '\\' or lower(file_name) like ?2 escape '\\' or lower(review_decision) like ?2 escape '\\'
             order by referenced desc, size desc
             limit ?3",
        )
        .map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map(params![keyword, pattern, limit], |row| {
            let path: String = row.get(0)?;
            let file_name: String = row.get(1)?;
            let size: u64 = row.get(2)?;
            let referenced: bool = row.get(3)?;
            let review_decision: String = row.get(4)?;
            let raw_json: String = row.get(5)?;
            Ok(ProjectIndexSearchItem {
                kind: "media".to_string(),
                id: path.clone(),
                title: file_name,
                subtitle: format!("{} · {}", if referenced { "已引用" } else { "疑似孤儿" }, review_decision),
                path,
                size,
                referenced,
                raw_json,
            })
        })
        .map_err(|err| err.to_string())?;
    collect_rows(rows, items)
}

fn search_media_references(
    conn: &Connection,
    keyword: &str,
    pattern: &str,
    limit: u64,
    items: &mut Vec<ProjectIndexSearchItem>,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "select media_path, source_path, value
             from media_reference_index
             where ?1 = '' or lower(media_path) like ?2 escape '\\' or lower(source_path) like ?2 escape '\\' or lower(value) like ?2 escape '\\'
             order by id desc
             limit ?3",
        )
        .map_err(|err| err.to_string())?;
    let rows = stmt
        .query_map(params![keyword, pattern, limit], |row| {
            let media_path: String = row.get(0)?;
            let source_path: String = row.get(1)?;
            let value: String = row.get(2)?;
            Ok(ProjectIndexSearchItem {
                kind: "mediaReference".to_string(),
                id: format!("{media_path}::{source_path}"),
                title: source_path,
                subtitle: media_path.clone(),
                path: value,
                size: 0,
                referenced: true,
                raw_json: String::new(),
            })
        })
        .map_err(|err| err.to_string())?;
    collect_rows(rows, items)
}

fn collect_rows(
    rows: rusqlite::MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<ProjectIndexSearchItem>>,
    items: &mut Vec<ProjectIndexSearchItem>,
) -> Result<(), String> {
    for row in rows {
        items.push(row.map_err(|err| err.to_string())?);
    }
    Ok(())
}

fn index_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("indexes").join("project-index.sqlite"))
}

fn value_array<'a>(value: &'a Value, key: &str) -> Vec<&'a Value> {
    value.get(key).and_then(|item| item.as_array()).map(|items| items.iter().collect()).unwrap_or_default()
}

fn value_string(value: &Value, key: &str) -> String {
    value.get(key).and_then(|item| item.as_str()).unwrap_or_default().to_string()
}

fn value_u64(value: &Value, key: &str) -> u64 {
    value.get(key).and_then(|item| item.as_u64()).unwrap_or(0)
}

fn value_bool(value: &Value, key: &str) -> bool {
    value.get(key).and_then(|item| item.as_bool()).unwrap_or(false)
}

fn count(conn: &Connection, table: &str) -> Result<u64, String> {
    let sql = format!("select count(*) from {table}");
    conn.query_row(&sql, [], |row| row.get::<_, u64>(0)).map_err(|err| err.to_string())
}

fn count_where(conn: &Connection, table: &str, condition: &str) -> Result<u64, String> {
    let sql = format!("select count(*) from {table} where {condition}");
    conn.query_row(&sql, [], |row| row.get::<_, u64>(0)).map_err(|err| err.to_string())
}

fn current_timestamp() -> u64 {
    UNIX_EPOCH.elapsed().map(|duration| duration.as_secs()).unwrap_or(0)
}

fn default_search_limit() -> u64 {
    50
}
