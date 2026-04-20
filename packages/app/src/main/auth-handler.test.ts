import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { AppStore } from "./store";

function createStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-test-"));
  return { dir, store: new AppStore(dir) };
}

function cleanup(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("AppStore - Auth", () => {
  it("returns empty auth by default", () => {
    const { dir, store } = createStore();
    const auth = store.getAuth();
    expect(auth.token).toBeNull();
    expect(auth.user).toBeNull();
    expect(auth.loginAt).toBeNull();
    cleanup(dir);
  });

  it("saves auth data with token and user", () => {
    const { dir, store } = createStore();
    const mockUser = {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      token: "jwt-token-123",
    };

    store.saveAuth("jwt-token-123", mockUser);

    const auth = store.getAuth();
    expect(auth.token).toBe("jwt-token-123");
    expect(auth.user).toEqual(mockUser);
    expect(auth.loginAt).toBeTruthy();
    cleanup(dir);
  });

  it("persists auth across instances", () => {
    const { dir, store } = createStore();
    const mockUser = {
      id: 42,
      name: "Persisted",
      email: "persist@test.com",
      token: "persist-token",
    };

    store.saveAuth("persist-token", mockUser);

    const store2 = new AppStore(dir);
    const auth = store2.getAuth();
    expect(auth.token).toBe("persist-token");
    expect(auth.user?.name).toBe("Persisted");
    expect(auth.user?.id).toBe(42);
    cleanup(dir);
  });

  it("clears auth on logout (null values)", () => {
    const { dir, store } = createStore();
    store.saveAuth("some-token", { id: 1, name: "User", email: "u@t.com", token: "some-token" });
    expect(store.getAuth().token).toBe("some-token");

    store.saveAuth(null, null);

    const auth = store.getAuth();
    expect(auth.token).toBeNull();
    expect(auth.user).toBeNull();
    expect(auth.loginAt).toBeNull();
    cleanup(dir);
  });

  it("auth does not interfere with sessions or settings", () => {
    const { dir, store } = createStore();

    store.saveAuth("auth-token", { id: 1, name: "A", email: "a@b.com", token: "auth-token" });
    store.createSession("Test Session");
    const settings = store.getSettings();
    settings.keys["KEY1"] = "VAL1";
    store.saveSettings(settings);

    const store2 = new AppStore(dir);
    expect(store2.getAuth().token).toBe("auth-token");
    expect(store2.listSessions().length).toBe(1);
    expect(store2.getSettings().keys["KEY1"]).toBe("VAL1");
    cleanup(dir);
  });

  it("handles missing auth field in existing store file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auth-migrate-"));
    const storeData = {
      settings: { keys: {}, defaults: { model: "test", provider: "openrouter", instructions: "", mcp: [], skills: [], workspacePath: "/", requireApproval: "none" as const } },
      sessions: {},
      messages: {},
      mcpLibrary: {},
      skillLibrary: {},
    };
    fs.writeFileSync(path.join(dir, "store.json"), JSON.stringify(storeData));

    const store = new AppStore(dir);
    const auth = store.getAuth();
    expect(auth.token).toBeNull();
    expect(auth.user).toBeNull();
    cleanup(dir);
  });

  it("updates loginAt timestamp on each save", () => {
    const { dir, store } = createStore();

    store.saveAuth("token-1", { id: 1, name: "A", email: "a@b.com", token: "token-1" });
    const firstLogin = store.getAuth().loginAt;
    expect(firstLogin).toBeTruthy();

    store.saveAuth("token-2", { id: 1, name: "A", email: "a@b.com", token: "token-2" });
    const secondLogin = store.getAuth().loginAt;
    expect(secondLogin).toBeTruthy();
    expect(new Date(secondLogin!).getTime()).toBeGreaterThanOrEqual(
      new Date(firstLogin!).getTime(),
    );
    cleanup(dir);
  });
});
