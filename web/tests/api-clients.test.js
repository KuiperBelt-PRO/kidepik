import assert from "node:assert/strict";
import { describe, it, afterEach, mock } from "node:test";

const session = { access_token: "test-token" };

describe("parent-account api", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("bootstrapParentIfNeeded", async () => {
    mock.method(globalThis, "fetch", async (url, opts) => {
      assert.match(String(url), /session\/bootstrap$/);
      assert.equal(opts?.method, "POST");
      return { ok: true, json: async () => ({ role: "tutor", created: true, parent_id: "p1" }) };
    });
    const { bootstrapParentIfNeeded } = await import("../js/lib/parent-account.js");
    const res = await bootstrapParentIfNeeded(session);
    assert.equal(res.ok, true);
    assert.equal(res.created, true);
  });

  it("fetchParentMe", async () => {
    mock.method(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({
        parent_id: "p1",
        auth_user_id: "a1",
        email: "a@b.com",
        display_name: "Ada",
        avatar_url: null,
        provider: "google",
      }),
    }));
    const { fetchParentMe } = await import("../js/lib/parent-account.js");
    const res = await fetchParentMe(session);
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.parent.display_name, "Ada");
  });

  it("updateParentDisplayName valida localmente", async () => {
    const { updateParentDisplayName } = await import("../js/lib/parent-account.js");
    const res = await updateParentDisplayName(session, "ada@x");
    assert.equal(res.ok, false);
    assert.equal(res.status, 422);
  });

  it("deleteParentAccount", async () => {
    mock.method(globalThis, "fetch", async () => ({ ok: true }));
    const { deleteParentAccount } = await import("../js/lib/parent-account.js");
    const res = await deleteParentAccount(session);
    assert.equal(res.ok, true);
  });
});

describe("crew-api", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("fetchCrewList", async () => {
    mock.method(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({ members: [], member_count: 0, member_limit: 10 }),
    }));
    const { fetchCrewList } = await import("../js/lib/crew-api.js");
    const res = await fetchCrewList(session);
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.member_limit, 10);
  });

  it("createCrewMember error", async () => {
    mock.method(globalThis, "fetch", async () => ({
      ok: false,
      status: 422,
      json: async () => ({ detail: "limit" }),
    }));
    const { createCrewMember } = await import("../js/lib/crew-api.js");
    const res = await createCrewMember(session);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.error, "limit");
  });

  it("patchCrewMember", async () => {
    mock.method(globalThis, "fetch", async () => ({
      ok: true,
      json: async () => ({ id: "c1" }),
    }));
    const { patchCrewMember } = await import("../js/lib/crew-api.js");
    const res = await patchCrewMember(session, "c1", { display_name: "Kid" });
    assert.equal(res.ok, true);
  });

  it("deleteCrewMember", async () => {
    mock.method(globalThis, "fetch", async () => ({ ok: true }));
    const { deleteCrewMember } = await import("../js/lib/crew-api.js");
    const res = await deleteCrewMember(session, "c1");
    assert.equal(res.ok, true);
  });

  it("fetchCrewMember y patchCrewPermissions", async () => {
    mock.method(globalThis, "fetch", async (url) => {
      if (String(url).includes("/permissions")) {
        return { ok: true, json: async () => ({ id: "c1", permissions: { require_exit_pin: true } }) };
      }
      return { ok: true, json: async () => ({ id: "c1" }) };
    });
    const { fetchCrewMember, patchCrewPermissions } = await import("../js/lib/crew-api.js");
    const get = await fetchCrewMember(session, "c1");
    assert.equal(get.ok, true);
    const patch = await patchCrewPermissions(session, "c1", { require_exit_pin: true });
    assert.equal(patch.ok, true);
  });
});
