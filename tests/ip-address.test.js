import { test } from "node:test";
import assert from "node:assert/strict";
import { isPrivateIP, normalizeIP } from "../app/services/ip-address.js";

test("private IPv4 ranges are detected", () => {
  for (const ip of [
    "10.0.0.1",
    "127.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.1.1",
    "100.64.0.1",
  ]) {
    assert.equal(isPrivateIP(ip), true, ip);
  }
});

test("public IPv4 addresses near private ranges are not private", () => {
  for (const ip of ["172.2.3.4", "172.32.0.1", "172.15.0.1", "8.8.8.8"]) {
    assert.equal(isPrivateIP(ip), false, ip);
  }
});

test("IPv6 loopback, unique-local and link-local are private", () => {
  for (const ip of ["::1", "fd12:3456::1", "fe80::1"]) {
    assert.equal(isPrivateIP(ip), true, ip);
  }
  assert.equal(isPrivateIP("2001:4860:4860::8888"), false);
});

test("normalizeIP takes the first forwarded address and unwraps IPv4-mapped IPv6", () => {
  assert.equal(normalizeIP("203.0.113.5, 10.0.0.1"), "203.0.113.5");
  assert.equal(normalizeIP("::ffff:203.0.113.5"), "203.0.113.5");
  assert.equal(normalizeIP(null), "");
});
