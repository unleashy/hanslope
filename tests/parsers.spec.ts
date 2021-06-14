import { str } from "../src";

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

function matched<T>(output: T, rest: string) {
  return { matched: true, output, rest };
}

function notMatched() {
  return { matched: false };
}
