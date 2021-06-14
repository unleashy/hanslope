import { matched, notMatched, or, Parser, re, str } from "../src";

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

describe("or", () => {
  describe("given two or more parsers", () => {
    it("tries them in order until one matches", () => {
      const calls: string[] = [];
      const p1: Parser<string> = () => {
        calls.push("p1");
        return notMatched();
      };
      const p2: Parser<string> = input => {
        calls.push("p2");
        return matched("p2", input);
      };
      const sut = or(p1, p2);

      expect(sut("abc")).toEqual(matched("p2", "abc"));
      expect(calls).toEqual(["p1", "p2"]);
    });

    it("fails if all parsers fail", () => {
      const failingP: Parser<string> = () => notMatched();
      const sut = or(failingP, failingP, failingP, failingP);

      expect(sut("")).toEqual(notMatched());
    });
  });
});
