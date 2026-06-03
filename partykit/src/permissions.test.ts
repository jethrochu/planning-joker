import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canUseHostAction, isHostOnlyMessage } from "./permissions.js";

describe("host permissions", () => {
  it("treats reveal and reset as host-only actions", () => {
    assert.equal(isHostOnlyMessage("reveal"), true);
    assert.equal(isHostOnlyMessage("reset"), true);
    assert.equal(isHostOnlyMessage("vote"), false);
  });

  it("allows only the host to reveal or reset", () => {
    assert.equal(canUseHostAction("host-client", "host-client", "reveal"), true);
    assert.equal(canUseHostAction("guest-client", "host-client", "reveal"), false);
    assert.equal(canUseHostAction("guest-client", "host-client", "reset"), false);
  });

  it("does not block regular room actions", () => {
    assert.equal(canUseHostAction("guest-client", "host-client", "vote"), true);
    assert.equal(canUseHostAction("guest-client", null, "vote"), true);
  });
});
