const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const source = ts.transpileModule(
  fs.readFileSync("src/lib/billing.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function load({ platform = "ios", dev = true, expoGo = false } = {}) {
  const calls = [];
  const state = { info: { entitlements: { active: {} } }, result: "CANCELLED" };
  const sdk = {
    setLogLevel: (level) => calls.push(["log", level]),
    configure: (options) => calls.push(["configure", options]),
    logIn: async (id) => calls.push(["login", id]),
    getCustomerInfo: async () => state.info,
    getOfferings: async () => ({
      current: { monthly: { identifier: "monthly" } },
    }),
  };
  const modules = {
    "react-native": { Platform: { OS: platform } },
    "expo-constants": {
      __esModule: true,
      default: { executionEnvironment: expoGo ? "storeClient" : "bare" },
    },
    "react-native-purchases": {
      __esModule: true,
      default: sdk,
      LOG_LEVEL: { VERBOSE: "verbose", WARN: "warn" },
    },
    "react-native-purchases-ui": {
      __esModule: true,
      default: {
        presentPaywall: async () => {
          calls.push(["paywall"]);
          return state.result;
        },
      },
      PAYWALL_RESULT: {
        PURCHASED: "PURCHASED",
        RESTORED: "RESTORED",
        CANCELLED: "CANCELLED",
        NOT_PRESENTED: "NOT_PRESENTED",
        ERROR: "ERROR",
      },
    },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (name) => modules[name],
    __DEV__: dev,
    process: {
      env: {
        EXPO_PUBLIC_REVENUECAT_IOS_KEY: "test_ios",
        EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: "test_android",
      },
    },
  });
  return { api: exports, calls, state };
}
(async () => {
  const { api, calls, state } = load();
  await Promise.all([api.billing("user-a"), api.billing("user-a")]);
  assert.equal(calls.filter((c) => c[0] === "configure").length, 1);
  assert.equal(calls[1][1].apiKey, "test_ios");
  assert.equal(calls[1][1].appUserID, "user-a");
  await api.billing("user-b");
  assert.equal(calls.at(-1)[1], "user-b");
  for (const result of ["CANCELLED", "NOT_PRESENTED"]) {
    state.result = result;
    assert.equal(await api.presentFreelaPaywall("user-b"), null);
  }
  state.result = "ERROR";
  await assert.rejects(api.presentFreelaPaywall("user-b"));
  for (const result of ["PURCHASED", "RESTORED"]) {
    state.result = result;
    assert.equal(await api.presentFreelaPaywall("user-b"), state.info);
  }
  state.info = { entitlements: { active: { freela: { isActive: true } } } };
  const before = calls.filter((c) => c[0] === "paywall").length;
  assert.equal(await api.presentFreelaPaywall("user-b"), state.info);
  assert.equal(calls.filter((c) => c[0] === "paywall").length, before);
  for (const opts of [{ dev: false }, { platform: "web" }, { expoGo: true }]) {
    const blocked = load(opts);
    assert.equal(blocked.api.billingAvailable, false);
    await assert.rejects(blocked.api.billing("user-a"));
    assert.equal(blocked.calls.length, 0);
  }
  const android = load({ platform: "android" });
  await android.api.billing("user-a");
  assert.equal(android.calls[1][1].apiKey, "test_android");
  console.log(
    "PASS: SDK initialization, identity switch, entitlement freela, paywall outcomes, test-key release guard, web/Expo Go guard.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
