import { re, str } from "../src";

describe("str", () => {
  describe("given an empty string", () => {
    it("always matches", () => {
      const sut = str("");

      expect(sut("")).toEqual(matched("", ""));
      expect(sut("abc")).toEqual(matched("", "abc"));
    });

    it("trims leading whitespace", () => {
      const sut = str("");

      expect(sut("  foo")).toEqual(matched("", "foo"));
      expect(sut("\f\t \r\n\v")).toEqual(matched("", ""));
    });
  });

  describe("given some string", () => {
    it("matches if the input starts with it", () => {
      const sut = str("abc");

      expect(sut("abc")).toEqual(matched("abc", ""));
      expect(sut("def")).toEqual(notMatched());
      expect(sut("abcdef")).toEqual(matched("abc", "def"));
    });

    it("trims leading whitespace", () => {
      const sut = str("foobar");

      expect(sut("  foobar")).toEqual(matched("foobar", ""));
      expect(sut("\f\t\r\n\vfoobar")).toEqual(matched("foobar", ""));
    });
  });
});

describe("re", () => {
  describe("given a regex", () => {
    it("matches the regex for the start of the input", () => {
      const sut = re(/[a-z]+[0-9]{3}/);

      expect(sut("abc123456")).toEqual(matched("abc123", "456"));
      expect(sut("nope")).toEqual(notMatched());
    });

    it("trims leading whitespace", () => {
      const sut = re(/h+ello/);

      expect(sut("  hhhhhhhello123")).toEqual(matched("hhhhhhhello", "123"));
      expect(sut("\f\t\r\n\vhello")).toEqual(matched("hello", ""));
    });
  });
});

function matched<T>(output: T, rest: string) {
  return { matched: true, output, rest };
}

function notMatched() {
  return { matched: false };
}
