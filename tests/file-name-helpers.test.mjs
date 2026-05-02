import assert from "node:assert/strict";
import test from "node:test";

import {
  safeFileName,
  shortPath,
} from "../src/file-name-helpers.js";

test("safeFileName replaces unsupported path characters and caps length", () => {
  assert.equal(safeFileName('a/b:c*d?"e<f>g|h'), "a_b_c_d_e_f_g_h");
  assert.equal(safeFileName(""), "result");
  assert.equal(safeFileName("x".repeat(60)), "x".repeat(40));
});

test("safeFileName supports explicit fallback and length", () => {
  assert.equal(safeFileName("", { fallback: "project" }), "project");
  assert.equal(safeFileName("abcdef", { maxLength: 3 }), "abc");
});

test("shortPath keeps only the final two path segments", () => {
  assert.equal(shortPath("C:\\Users\\ADMIN\\project.wxh"), "ADMIN\\project.wxh");
  assert.equal(shortPath("/home/admin/project.wxh"), "admin\\project.wxh");
  assert.equal(shortPath("project.wxh"), "project.wxh");
});
