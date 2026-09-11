import { describe, expect, test } from "bun:test";
import { parseCookieString } from "../espn-cookies";

const SWID = "{3F2A9C1E-1B2C-4D5E-8F90-A1B2C3D4E5F6}";

describe("parseCookieString", () => {
  test("reads the bookmarklet's output, leaving espn_s2 as pasted", () => {
    expect(parseCookieString(`espn_s2=AEBabc%2Bdef; SWID=${SWID}`)).toEqual({
      s2: "AEBabc%2Bdef",
      swid: SWID,
    });
  });

  test("decodes a SWID copied straight from document.cookie", () => {
    // Percent-encoded braces would key a second connection for the same account.
    const raw = "region=unknown; SWID=%7B3F2A9C1E-1B2C-4D5E-8F90-A1B2C3D4E5F6%7D; espn_s2=AEBxyz; other=1";
    expect(parseCookieString(raw)).toEqual({ s2: "AEBxyz", swid: SWID });
  });

  test("trims stray whitespace", () => {
    expect(parseCookieString(`espn_s2= AEB ;SWID= ${SWID} `)).toEqual({ s2: "AEB", swid: SWID });
  });

  test("needs both cookies", () => {
    expect(parseCookieString("espn_s2=AEB")).toBeNull();
    expect(parseCookieString(`SWID=${SWID}`)).toBeNull();
    expect(parseCookieString("espn_s2= ; SWID= ")).toBeNull();
    expect(parseCookieString("")).toBeNull();
  });

  test("keeps a SWID with a malformed escape as pasted", () => {
    expect(parseCookieString("espn_s2=AEB; SWID={ABC%ZZ}")?.swid).toBe("{ABC%ZZ}");
  });
});
