import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { AppStore } from "./store";

function createStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "store-test-"));
  return { dir, store: new AppStore(dir) };
}

function cleanup(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("AppStore - Settings", () => {
  it("returns default settings on first load", () => {
    const { dir, store } = createStore();
    const settings = store.getSettings();
    expect(settings.defaults.model).toBe("anthropic/claude-sonnet-4.6");
    expect(settings.defaults.provider).toBe("nexai");
    expect(settings.keys).toEqual({});
    cleanup(dir);
  });

  it("persists settings across instances", () => {
    const { dir, store } = createStore();
    const settings = store.getSettings();
    settings.keys["OPENAI_API_KEY"] = "sk-test-123";
    store.saveSettings(settings);

    const store2 = new AppStore(dir);
    expect(store2.getSettings().keys["OPENAI_API_KEY"]).toBe("sk-test-123");
    cleanup(dir);
  });

  it("updates nested defaults without losing other fields", () => {
    const { dir, store } = createStore();
    const settings = store.getSettings();
    settings.defaults.model = "gpt-4o";
    settings.defaults.instructions = "Be concise";
    store.saveSettings(settings);

    const loaded = store.getSettings();
    expect(loaded.defaults.model).toBe("gpt-4o");
    expect(loaded.defaults.instructions).toBe("Be concise");
    expect(loaded.defaults.provider).toBe("nexai");
    cleanup(dir);
  });
});

describe("AppStore - Sessions", () => {
  it("creates a session with default config from settings", () => {
    const { dir, store } = createStore();
    const session = store.createSession("Test Chat");
    expect(session.id).toBeTruthy();
    expect(session.name).toBe("Test Chat");
    expect(session.config.model).toBe("anthropic/claude-sonnet-4.6");
    expect(session.config.maxSteps).toBe(25);
    cleanup(dir);
  });

  it("auto-generates session name when none provided", () => {
    const { dir, store } = createStore();
    const session = store.createSession();
    expect(session.name).toMatch(/^Session \d{2}-\d{2} \d{2}:\d{2}$/);
    cleanup(dir);
  });

  it("lists sessions and returns them as an array", () => {
    const { dir, store } = createStore();

    store.createSession("Alpha");
    store.createSession("Beta");
    store.createSession("Gamma");

    const list = store.listSessions();
    expect(list.length).toBe(3);
    const names = list.map((s) => s.name);
    expect(names).toContain("Alpha");
    expect(names).toContain("Beta");
    expect(names).toContain("Gamma");
    cleanup(dir);
  });

  it("gets a session by id", () => {
    const { dir, store } = createStore();
    const created = store.createSession("Lookup");
    const found = store.getSession(created.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Lookup");
    cleanup(dir);
  });

  it("returns null for non-existent session", () => {
    const { dir, store } = createStore();
    expect(store.getSession("non-existent")).toBeNull();
    cleanup(dir);
  });

  it("deletes a session and its messages", () => {
    const { dir, store } = createStore();
    const session = store.createSession("ToDelete");
    store.saveMessage({
      id: "msg-1",
      sessionId: session.id,
      role: "user",
      content: "hello",
      createdAt: new Date().toISOString(),
    });

    store.deleteSession(session.id);
    expect(store.getSession(session.id)).toBeNull();
    expect(store.getMessages(session.id)).toEqual([]);
    expect(store.listSessions().length).toBe(0);
    cleanup(dir);
  });

  it("renames a session", () => {
    const { dir, store } = createStore();
    const session = store.createSession("Old Name");
    store.renameSession(session.id, "New Name");
    expect(store.getSession(session.id)!.name).toBe("New Name");
    cleanup(dir);
  });

  it("updates session config partially", () => {
    const { dir, store } = createStore();
    const session = store.createSession("Cfg");
    const updated = store.updateSessionConfig(session.id, {
      model: "gpt-4o",
      maxSteps: 50,
    });

    expect(updated).not.toBeNull();
    expect(updated!.config.model).toBe("gpt-4o");
    expect(updated!.config.maxSteps).toBe(50);
    expect(updated!.config.provider).toBe("nexai");
    cleanup(dir);
  });

  it("returns null when updating non-existent session", () => {
    const { dir, store } = createStore();
    expect(store.updateSessionConfig("no-exist", { model: "x" })).toBeNull();
    cleanup(dir);
  });
});

describe("AppStore - Messages", () => {
  it("saves and retrieves messages in order", () => {
    const { dir, store } = createStore();
    const session = store.createSession("MsgTest");
    const now = new Date().toISOString();

    store.saveMessage({
      id: "m1",
      sessionId: session.id,
      role: "user",
      content: "Hello",
      createdAt: now,
    });
    store.saveMessage({
      id: "m2",
      sessionId: session.id,
      role: "assistant",
      content: "Hi there!",
      createdAt: now,
    });

    const msgs = store.getMessages(session.id);
    expect(msgs.length).toBe(2);
    expect(msgs[0].role).toBe("user");
    expect(msgs[1].role).toBe("assistant");
    cleanup(dir);
  });

  it("respects limit and offset", () => {
    const { dir, store } = createStore();
    const session = store.createSession("Pagination");
    for (let i = 0; i < 10; i++) {
      store.saveMessage({
        id: `m-${i}`,
        sessionId: session.id,
        role: "user",
        content: `Message ${i}`,
        createdAt: new Date().toISOString(),
      });
    }

    const page1 = store.getMessages(session.id, 3, 0);
    expect(page1.length).toBe(3);
    expect(page1[0].content).toBe("Message 0");

    const page2 = store.getMessages(session.id, 3, 3);
    expect(page2.length).toBe(3);
    expect(page2[0].content).toBe("Message 3");
    cleanup(dir);
  });

  it("updates session updatedAt on new message", () => {
    const { dir, store } = createStore();
    const session = store.createSession("TimeCheck");
    const before = store.getSession(session.id)!.updatedAt;

    store.saveMessage({
      id: "m-time",
      sessionId: session.id,
      role: "user",
      content: "update time",
      createdAt: new Date().toISOString(),
    });

    const after = store.getSession(session.id)!.updatedAt;
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime(),
    );
    cleanup(dir);
  });

  it("returns empty array for unknown session", () => {
    const { dir, store } = createStore();
    expect(store.getMessages("unknown")).toEqual([]);
    cleanup(dir);
  });
});

describe("AppStore - Persistence", () => {
  it("survives JSON file reload", () => {
    const { dir, store } = createStore();
    store.createSession("Persist1");
    store.createSession("Persist2");

    const settings = store.getSettings();
    settings.keys["KEY"] = "VAL";
    store.saveSettings(settings);

    const store2 = new AppStore(dir);
    expect(store2.listSessions().length).toBe(2);
    expect(store2.getSettings().keys["KEY"]).toBe("VAL");
    cleanup(dir);
  });

  it("handles corrupted file gracefully", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "store-corrupt-"));
    fs.writeFileSync(path.join(dir, "store.json"), "NOT VALID JSON");
    const store = new AppStore(dir);
    expect(store.listSessions()).toEqual([]);
    expect(store.getSettings().keys).toEqual({});
    cleanup(dir);
  });
});
