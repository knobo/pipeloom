// Backend for pipeloom: mirrors `pw-dump -m` into a map and shells out to wpctl/pw-* for mutations.
// Contract: src/lib/api.ts.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::Value;
use std::collections::BTreeMap;
use std::io::BufReader;
use std::process::{Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

type Objs = BTreeMap<u64, Value>;
type Shared = Arc<Mutex<Objs>>;

const EVENT: &str = "pw-snapshot";

fn snapshot(m: &Objs) -> Vec<Value> {
    m.values().cloned().collect()
}

/// Applies one array from `pw-dump -m` to the map. Observed semantics (PipeWire 1.6):
/// - removal: `{"id":N,"info":null}` (no "type"), for every kind incl. Metadata;
/// - non-metadata updates: the whole object is reprinted, so replace;
/// - Metadata updates: only the changed entries are printed, and deleted entries are
///   not printed at all (a delete shows up as `"metadata": []`).
/// Metadata entries are merged by (subject,key) here; the returned ids must be refetched
/// by the caller to catch deletions.
fn apply_batch(m: &mut Objs, batch: Vec<Value>) -> Vec<u64> {
    let mut refetch = Vec::new();
    for mut o in batch {
        let Some(id) = o.get("id").and_then(Value::as_u64) else { continue };
        if o.get("type").is_none() {
            m.remove(&id);
            continue;
        }
        let old = m.get_mut(&id);
        match (old, o.get_mut("metadata").map(Value::take)) {
            (Some(old), Some(Value::Array(changed))) if old.get("metadata").is_some() => {
                let mut entries = match old["metadata"].take() {
                    Value::Array(a) => a,
                    _ => Vec::new(),
                };
                for e in changed {
                    let same = |x: &Value| x["subject"] == e["subject"] && x["key"] == e["key"];
                    match entries.iter_mut().find(|x| same(x)) {
                        Some(x) => *x = e,
                        None => entries.push(e),
                    }
                }
                o["metadata"] = Value::Array(entries);
                *old = o;
                refetch.push(id);
            }
            (_, md) => {
                if let Some(md) = md {
                    o["metadata"] = md;
                }
                m.insert(id, o);
            }
        }
    }
    refetch
}

/// One-shot `pw-dump <id>`; pw-dump also matches serials, so filter by id.
fn fetch(id: u64) -> Option<Value> {
    let out = Command::new("pw-dump").args(["-N", &id.to_string()]).output().ok()?;
    let objs: Vec<Value> = serde_json::from_slice(&out.stdout).ok()?;
    objs.into_iter().find(|o| o["id"].as_u64() == Some(id))
}

fn monitor(app: AppHandle, state: Shared) {
    let (tx, rx) = mpsc::channel::<()>();
    // Debounce: emit once the stream has been quiet for 40 ms.
    let (app2, state2) = (app.clone(), state.clone());
    thread::spawn(move || {
        while rx.recv().is_ok() {
            while rx.recv_timeout(Duration::from_millis(40)).is_ok() {}
            let snap = snapshot(&state2.lock().unwrap());
            let _ = app2.emit(EVENT, snap);
        }
    });
    loop {
        match Command::new("pw-dump")
            .args(["-m", "-N"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
        {
            Ok(mut child) => {
                let stdout = BufReader::new(child.stdout.take().unwrap());
                for batch in serde_json::Deserializer::from_reader(stdout).into_iter::<Vec<Value>>() {
                    let Ok(batch) = batch else { break };
                    let refetch = apply_batch(&mut state.lock().unwrap(), batch);
                    for id in refetch {
                        if let Some(o) = fetch(id) {
                            state.lock().unwrap().insert(id, o);
                        }
                    }
                    let _ = tx.send(());
                }
                let _ = child.kill();
                let _ = child.wait();
                eprintln!("pipeloom: pw-dump exited, respawning in 1s");
            }
            Err(e) => eprintln!("pipeloom: cannot start pw-dump: {e}"),
        }
        state.lock().unwrap().clear();
        let _ = tx.send(());
        thread::sleep(Duration::from_secs(1));
    }
}

// ---- mutations ----

/// Runs a tool without a shell. These tools often exit 0 on failure and print
/// "Failed ..."/"Error: ..." instead, so check the output too.
fn run(prog: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new(prog)
        .args(args)
        .output()
        .map_err(|e| format!("{prog}: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&out.stderr);
    let text = format!("{stderr}{stdout}").trim().to_string();
    if cfg!(debug_assertions) {
        eprintln!("[cmd] {prog} {args:?} -> {} {text}", out.status);
    }
    let failed = text.lines().any(|l| {
        let l = l.trim_start().to_ascii_lowercase();
        l.starts_with("failed") || l.starts_with("error")
    });
    if !out.status.success() || failed {
        return Err(if text.is_empty() { format!("{prog} failed: {}", out.status) } else { text });
    }
    Ok(stdout)
}

fn check_name(what: &str, s: &str) -> Result<(), String> {
    let ok = !s.is_empty()
        && s.len() <= 256
        && s.chars().all(|c| c.is_ascii_alphanumeric() || "._:/-".contains(c));
    if ok { Ok(()) } else { Err(format!("invalid {what}: {s:?}")) }
}

/// pw-metadata silently does nothing (exit 0) when the metadata name does not exist.
fn pw_metadata(args: &[&str]) -> Result<(), String> {
    let out = run("pw-metadata", args)?;
    if out.contains("Found ") { Ok(()) } else { Err(format!("metadata not found: {}", args[1])) }
}

/// Frontend errors end up in the terminal running `tauri dev`.
#[tauri::command]
fn ui_log(msg: String) {
    eprintln!("[ui] {msg}");
}

#[tauri::command]
fn get_snapshot(state: State<Shared>) -> Vec<Value> {
    snapshot(&state.lock().unwrap())
}

#[tauri::command(async)]
fn set_setting(key: String, value: Value, save: bool) -> Result<(), String> {
    check_name("key", &key)?;
    // wpctl stores the text as Spa:String:JSON, so JSON text (strings quoted) is right.
    let v = value.to_string();
    let mut args = vec!["settings"];
    if save {
        args.push("--save");
    }
    args.extend(["--", &key, &v]);
    run("wpctl", &args).map(drop)
}

#[tauri::command(async)]
fn reset_setting(key: String) -> Result<(), String> {
    check_name("key", &key)?;
    run("wpctl", &["settings", "--reset", "--", &key]).map(drop)
}

#[tauri::command(async)]
fn link(out_port: u32, in_port: u32) -> Result<(), String> {
    run("pw-link", &[&out_port.to_string(), &in_port.to_string()]).map(drop)
}

#[tauri::command(async)]
fn unlink(link_id: u32) -> Result<(), String> {
    run("pw-link", &["-d", &link_id.to_string()]).map(drop)
}

#[tauri::command(async)]
fn set_volume(id: u32, volume: f64) -> Result<(), String> {
    if !volume.is_finite() {
        return Err("invalid volume".into());
    }
    let v = format!("{:.4}", volume.clamp(0.0, 1.5));
    run("wpctl", &["set-volume", &id.to_string(), &v]).map(drop)
}

#[tauri::command(async)]
fn set_mute(id: u32, mute: bool) -> Result<(), String> {
    run("wpctl", &["set-mute", &id.to_string(), if mute { "1" } else { "0" }]).map(drop)
}

#[tauri::command(async)]
fn set_default(id: u32) -> Result<(), String> {
    run("wpctl", &["set-default", &id.to_string()]).map(drop)
}

#[tauri::command(async)]
fn set_profile(device_id: u32, index: u32) -> Result<(), String> {
    run("wpctl", &["set-profile", &device_id.to_string(), &index.to_string()]).map(drop)
}

#[tauri::command(async)]
fn set_route(device_id: u32, index: u32, device: u32) -> Result<(), String> {
    let pod = format!("{{ index: {index}, device: {device}, save: true }}");
    run("pw-cli", &["s", &device_id.to_string(), "Route", &pod]).map(drop)
}

#[tauri::command(async)]
fn set_metadata(
    name: String,
    subject: u32,
    key: String,
    value: String,
    r#type: Option<String>,
) -> Result<(), String> {
    check_name("metadata name", &name)?;
    check_name("key", &key)?;
    let s = subject.to_string();
    let mut args = vec!["-n", &name, "--", &s, &key, &value];
    if let Some(t) = &r#type {
        check_name("type", t)?;
        args.push(t);
    }
    pw_metadata(&args)
}

#[tauri::command(async)]
fn delete_metadata(name: String, subject: u32, key: String) -> Result<(), String> {
    check_name("metadata name", &name)?;
    check_name("key", &key)?;
    pw_metadata(&["-n", &name, "-d", "--", &subject.to_string(), &key])
}

fn main() {
    let state: Shared = Default::default();
    tauri::Builder::default()
        .manage(state.clone())
        .setup(move |app| {
            let handle = app.handle().clone();
            thread::spawn(move || monitor(handle, state));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ui_log,
            get_snapshot,
            set_setting,
            reset_setting,
            link,
            unlink,
            set_volume,
            set_mute,
            set_default,
            set_profile,
            set_route,
            set_metadata,
            delete_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while running pipeloom");
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = r#"
[
  { "id": 1, "type": "PipeWire:Interface:Node", "info": { "props": { "node.name": "a" } } },
  { "id": 2, "type": "PipeWire:Interface:Port", "info": { "props": {} } },
  { "id": 38, "type": "PipeWire:Interface:Metadata", "props": { "metadata.name": "sm-settings" },
    "metadata": [
      { "subject": 0, "key": "x", "type": "Spa:String:JSON", "value": 1 },
      { "subject": 0, "key": "y", "type": "Spa:String:JSON", "value": 2 } ] }
]
[
  { "id": 1, "type": "PipeWire:Interface:Node", "info": { "props": { "node.name": "b" } } },
  { "id": 38, "type": "PipeWire:Interface:Metadata", "props": { "metadata.name": "sm-settings" },
    "metadata": [
      { "subject": 0, "key": "y", "type": "Spa:String:JSON", "value": 3 },
      { "subject": 0, "key": "z", "type": null, "value": "v" } ] }
]
[
  {
    "id": 2,
    "info": null
  }
]"#;

    #[test]
    fn stream_merge() {
        let mut m = Objs::new();
        let mut refetch = Vec::new();
        for b in serde_json::Deserializer::from_str(FIXTURE).into_iter::<Vec<Value>>() {
            refetch.extend(apply_batch(&mut m, b.unwrap()));
        }
        assert_eq!(m.keys().copied().collect::<Vec<_>>(), vec![1, 38]);
        assert_eq!(m[&1]["info"]["props"]["node.name"], "b");
        let md = m[&38]["metadata"].as_array().unwrap();
        let kv: Vec<_> = md.iter().map(|e| (e["key"].as_str().unwrap(), e["value"].clone())).collect();
        assert_eq!(kv, vec![("x", 1.into()), ("y", 3.into()), ("z", "v".into())]);
        assert_eq!(m[&38]["props"]["metadata.name"], "sm-settings");
        assert_eq!(refetch, vec![38]); // initial insert is full, only the update needs a refetch
    }

    /// Against the live PipeWire: `cargo test -- --ignored`. Only touches a throwaway
    /// key in sm-settings and re-sets duck-level to its current value.
    #[test]
    #[ignore]
    fn live_smoke() {
        let mut child = Command::new("pw-dump").args(["-m", "-N"]).stdout(Stdio::piped()).spawn().unwrap();
        let stdout = BufReader::new(child.stdout.take().unwrap());
        let state: Shared = Default::default();
        let s2 = state.clone();
        thread::spawn(move || {
            for b in serde_json::Deserializer::from_reader(stdout).into_iter::<Vec<Value>>() {
                let refetch = apply_batch(&mut s2.lock().unwrap(), b.unwrap());
                for id in refetch {
                    if let Some(o) = fetch(id) {
                        s2.lock().unwrap().insert(id, o);
                    }
                }
            }
        });
        thread::sleep(Duration::from_millis(1500));
        set_metadata("sm-settings".into(), 0, "pipeloom.smoke".into(), "1".into(), None).unwrap();
        thread::sleep(Duration::from_millis(500));
        delete_metadata("sm-settings".into(), 0, "pipeloom.smoke".into()).unwrap();
        let cur = wpctl_value("linking.role-based.duck-level");
        set_setting("linking.role-based.duck-level".into(), serde_json::from_str(&cur).unwrap(), false).unwrap();
        assert!(set_setting("no.such.key".into(), 1.into(), false).is_err());
        assert!(set_metadata("no-such-metadata".into(), 0, "k".into(), "v".into(), None).is_err());
        assert!(set_setting("bad key;".into(), 1.into(), false).is_err());
        thread::sleep(Duration::from_millis(1500));
        let fresh: Vec<Value> = serde_json::from_slice(&Command::new("pw-dump").arg("-N").output().unwrap().stdout).unwrap();
        let _ = child.kill();
        let mine = state.lock().unwrap();
        let mut bad = 0;
        for o in &fresh {
            let id = o["id"].as_u64().unwrap();
            let strip = |v: &Value| { let mut v = v.clone(); if let Some(i) = v.get_mut("info").and_then(Value::as_object_mut) { i.remove("change-mask"); } v };
            // Clients of the two pw-dump processes legitimately differ.
            if o["type"].as_str().unwrap().ends_with("Client") { continue; }
            if mine.get(&id).map(strip) != Some(strip(o)) { eprintln!("mismatch id {id} {}", o["type"]); bad += 1; }
        }
        let missing: Vec<_> = mine.keys().filter(|k| !fresh.iter().any(|o| o["id"].as_u64() == Some(**k))).collect();
        eprintln!("objects {} mismatches {bad} extra {missing:?}", fresh.len());
        assert_eq!(bad, 0);
        assert!(!mine.values().any(|o| o["metadata"].as_array().is_some_and(|a| a.iter().any(|e| e["key"] == "pipeloom.smoke"))));
    }

    fn wpctl_value(key: &str) -> String {
        let out = run("wpctl", &["settings", key]).unwrap();
        out.trim().strip_prefix("Value: ").unwrap().to_string()
    }
}
