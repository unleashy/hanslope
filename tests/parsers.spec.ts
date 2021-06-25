import {
  any,
  fail,
  labelFail,
  many,
  many1,
  matched,
  maybe,
  not,
  notMatched,
  or,
  Parser,
  re,
  seq,
  str,
  tag
} from "../src";

describe("any", () => {
  it("matches any single character", () => {
    expect(any("ab")).toEqual(matched("a", "b"));
    expect(any(" ")).toEqual(matched(" ", ""));
  });

  it("fails if the input is empty", () => {
    expect(any("")).toEqual(notMatched(""));
  });
});

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
      expect(sut("def")).toEqual(notMatched("def"));
      expect(sut("abcdef")).toEqual(matched("abc", "def"));
    });

    it("trims leading whitespace", () => {
      const sut = str("foobar");

      expect(sut("  foobar")).toEqual(matched("foobar", ""));
      expect(sut("\f\t\r\n\vfoobar")).toEqual(matched("foobar", ""));
    });
  });

  describe("given trim: false", () => {
    it("does not trim leading whitespace", () => {
      const sut = str("hey", { trim: false });

      expect(sut("hey")).toEqual(matched("hey", ""));
      expect(sut(" \f\t\r\n\vhey")).toEqual(notMatched(" \f\t\r\n\vhey"));
    });
  });
});

describe("re", () => {
  describe("given a regex", () => {
    it("matches the regex for the start of the input", () => {
      const sut = re(/[a-z]+[0-9]{3}/);

      expect(sut("abc123456")).toEqual(matched("abc123", "456"));
      expect(sut("nope")).toEqual(notMatched("nope"));
    });

    it("trims leading whitespace", () => {
      const sut = re(/h+ello/);

      expect(sut("  hhhhhhhello123")).toEqual(matched("hhhhhhhello", "123"));
      expect(sut("\f\t\r\n\vhello")).toEqual(matched("hello", ""));
    });
  });

  describe("given trim: false", () => {
    it("does not trim leading whitespace", () => {
      const sut = re(/yep/, { trim: false });

      expect(sut("yep")).toEqual(matched("yep", ""));
      expect(sut(" \f\t\r\n\vyep")).toEqual(notMatched(" \f\t\r\n\vyep"));
    });
  });
});

describe("or", () => {
  describe("given two or more parsers", () => {
    it("tries them in order until one matches", () => {
      const calls: string[] = [];
      const p1: Parser<string> = () => {
        calls.push("p1");
        return notMatched("abc");
      };
      const p2: Parser<string> = input => {
        calls.push("p2");
        return matched("p2", input);
      };
      const sut = or(p1, p2);

      expect(sut("abc")).toEqual(matched("p2", "abc"));
      expect(calls).toEqual(["p1", "p2"]);
    });

    it("fails with the furthest failure if all parsers fail", () => {
      const sut = or(
        () => notMatched("a"),
        () => notMatched("ab"),
        () => notMatched("b"),
        () => notMatched("abc")
      );

      expect(sut("")).toEqual(notMatched("a"));
    });

    it("immediately propagates labelled failures", () => {
      const calls: string[] = [];
      const failingP: Parser<null> = () => {
        calls.push("failingP");
        return notMatched("abc", "woops");
      };
      const matchingP: Parser<string> = input => {
        calls.push("matchingP");
        return matched("", input);
      };
      const sut = or(failingP, matchingP);

      expect(sut("")).toEqual(notMatched("abc", "woops"));
      expect(calls).toEqual(["failingP"]);
    });
  });
});

describe("seq", () => {
  describe("given two or more parsers", () => {
    it("calls them in sequence", () => {
      const p: Parser<string> = input =>
        matched(input[0] ?? "", input.slice(1));
      const sut = seq(p, p, p);

      expect(sut("abc")).toEqual(
        matched({ type: "seq", children: ["a", "b", "c"] }, "")
      );
    });

    it("fails if any parser fails", () => {
      const calls: string[] = [];
      const matchingP: Parser<string> = () => {
        calls.push("matchingP");
        return matched("", "");
      };
      const failingP: Parser<string> = () => {
        calls.push("failingP");
        return notMatched("abc");
      };
      const sut = seq(matchingP, failingP, matchingP);

      expect(sut("")).toEqual(notMatched("abc"));
      expect(calls).toEqual(["matchingP", "failingP"]);
    });

    it("immediately propagates labelled failures", () => {
      const calls: string[] = [];
      const failingP: Parser<null> = () => {
        calls.push("failingP");
        return notMatched("def", "woops");
      };
      const matchingP: Parser<string> = input => {
        calls.push("matchingP");
        return matched("", input);
      };
      const sut = seq(failingP, matchingP);

      expect(sut("")).toEqual(notMatched("def", "woops"));
      expect(calls).toEqual(["failingP"]);
    });
  });
});

describe("many", () => {
  describe("given a single parser", () => {
    it("calls it until failure", () => {
      const calls: string[] = [];
      const p: Parser<string> = input => {
        calls.push(input);
        return input.length > 0
          ? matched(input[0] ?? "", input.slice(1))
          : notMatched("foo");
      };
      const sut = many(p);

      expect(sut("abc")).toEqual(
        matched({ type: "many", children: ["a", "b", "c"] }, "")
      );
      expect(calls).toEqual(["abc", "bc", "c", ""]);
    });

    it("succeeds even if the first match fails", () => {
      const p: Parser<string> = () => notMatched("foo");
      const sut = many(p);

      expect(sut("abc")).toEqual(
        matched({ type: "many", children: [] }, "abc")
      );
    });

    it("immediately propagates labelled failures", () => {
      const failingP: Parser<null> = () => notMatched("foo", "woops");
      const sut = many(failingP);

      expect(sut("")).toEqual(notMatched("foo", "woops"));
    });
  });
});

describe("many1", () => {
  describe("given a parser", () => {
    it("calls it until failure", () => {
      const calls: string[] = [];
      const p: Parser<string> = input => {
        calls.push(input);
        return input.length > 0
          ? matched(input[0] ?? "", input.slice(1))
          : notMatched("foo");
      };
      const sut = many1(p);

      expect(sut("abc")).toEqual(
        matched({ type: "many", children: ["a", "b", "c"] }, "")
      );
      expect(calls).toEqual(["abc", "bc", "c", ""]);
    });

    it("fails if there are no matches", () => {
      const p: Parser<string> = () => notMatched("foo");
      const sut = many1(p);

      expect(sut("abc")).toEqual(notMatched("abc"));
    });

    it("immediately propagates labelled failures", () => {
      const failingP: Parser<null> = () => notMatched("foo", "woops");
      const sut = many1(failingP);

      expect(sut("")).toEqual(notMatched("foo", "woops"));
    });
  });
});

describe("maybe", () => {
  describe("given a parser", () => {
    it("optionally matches", () => {
      const p: Parser<string> = input =>
        input.length === 1
          ? matched("hello", input.slice(1))
          : notMatched("foo");
      const sut = maybe(p);

      expect(sut("a")).toEqual(matched("hello", ""));
      expect(sut("ab")).toEqual(matched(null, "ab"));
    });

    it("immediately propagates labelled failures", () => {
      const failingP: Parser<null> = () => notMatched("foo", "woops");
      const sut = maybe(failingP);

      expect(sut("")).toEqual(notMatched("foo", "woops"));
    });
  });
});

describe("not", () => {
  describe("given a parser", () => {
    it("matches if it fails, keeping the input intact", () => {
      const p: Parser<string> = () => notMatched("foo");
      const sut = not(p);

      expect(sut("abc")).toEqual(matched(null, "abc"));
    });

    it("fails if it matches", () => {
      const p: Parser<string> = () => matched("abc", "def");
      const sut = not(p);

      expect(sut("abc")).toEqual(notMatched("abc"));
    });

    it("immediately propagates labelled failures", () => {
      const failingP: Parser<null> = () => notMatched("foo", "woops");
      const sut = not(failingP);

      expect(sut("")).toEqual(notMatched("foo", "woops"));
    });
  });
});

describe("tag", () => {
  describe("given a tag and a parser", () => {
    it("tags the result", () => {
      const p: Parser<string> = input => matched("foo", input);
      const sut = tag("hello", p);

      expect(sut("123")).toEqual(
        matched({ type: "tag", tag: "hello", child: "foo" }, "123")
      );
    });

    it("does not tag failures", () => {
      const p: Parser<string> = () => notMatched("foo");
      const sut = tag("hello", p);

      expect(sut("123")).toEqual(notMatched("foo"));
    });

    it("immediately propagates labelled failures", () => {
      const failingP: Parser<null> = () => notMatched("foo", "woops");
      const sut = tag("", failingP);

      expect(sut("")).toEqual(notMatched("foo", "woops"));
    });
  });
});

describe("fail", () => {
  describe("given a label", () => {
    it("fails using it", () => {
      const sut = fail("abc");

      expect(sut("def")).toEqual(notMatched("def", "abc"));
    });
  });
});

describe("labelFail", () => {
  describe("given a parser and a label", () => {
    it("uses the label if the parser fails", () => {
      const p: Parser<string> = input =>
        input === "ok" ? matched("ok", input) : notMatched("foo");
      const sut = labelFail(p, "rip");

      expect(sut("ok")).toEqual(matched("ok", "ok"));
      expect(sut("nope")).toEqual(notMatched("foo", "rip"));
    });

    it("immediately propagates labelled failures", () => {
      const failingP: Parser<null> = () => notMatched("foo", "woops");
      const sut = labelFail(failingP, "not used!");

      expect(sut("")).toEqual(notMatched("foo", "woops"));
    });
  });
});
