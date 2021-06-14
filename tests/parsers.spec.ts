import {
  any,
  CSTMany,
  CSTNode,
  CSTSeq,
  CSTTagged,
  cstToAst,
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
  tag,
  fail
} from "../src";

describe("any", () => {
  it("matches any single character", () => {
    expect(any("ab")).toEqual(matched("a", "b"));
    expect(any(" ")).toEqual(matched(" ", ""));
  });

  it("fails if the input is empty", () => {
    expect(any("")).toEqual(notMatched());
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

    it("immediately propagates labelled failures", () => {
      const calls: string[] = [];
      const failingP: Parser<null> = () => {
        calls.push("failingP");
        return notMatched("woops");
      };
      const matchingP: Parser<string> = input => {
        calls.push("matchingP");
        return matched("", input);
      };
      const sut = or(failingP, matchingP);

      expect(sut("")).toEqual(notMatched("woops"));
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
        return notMatched();
      };
      const sut = seq(matchingP, failingP, matchingP);

      expect(sut("")).toEqual(notMatched());
      expect(calls).toEqual(["matchingP", "failingP"]);
    });

    it("immediately propagates labelled failures", () => {
      const calls: string[] = [];
      const failingP: Parser<null> = () => {
        calls.push("failingP");
        return notMatched("woops");
      };
      const matchingP: Parser<string> = input => {
        calls.push("matchingP");
        return matched("", input);
      };
      const sut = seq(failingP, matchingP);

      expect(sut("")).toEqual(notMatched("woops"));
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
          : notMatched();
      };
      const sut = many(p);

      expect(sut("abc")).toEqual(
        matched({ type: "many", children: ["a", "b", "c"] }, "")
      );
      expect(calls).toEqual(["abc", "bc", "c", ""]);
    });

    it("succeeds even if the first match fails", () => {
      const p: Parser<string> = () => notMatched();
      const sut = many(p);

      expect(sut("abc")).toEqual(
        matched({ type: "many", children: [] }, "abc")
      );
    });

    it("immediately propagates labelled failures", () => {
      const failingP: Parser<null> = () => notMatched("woops");
      const sut = many(failingP);

      expect(sut("")).toEqual(notMatched("woops"));
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
          : notMatched();
      };
      const sut = many1(p);

      expect(sut("abc")).toEqual(
        matched({ type: "many", children: ["a", "b", "c"] }, "")
      );
      expect(calls).toEqual(["abc", "bc", "c", ""]);
    });

    it("fails if there are no matches", () => {
      const p: Parser<string> = () => notMatched();
      const sut = many1(p);

      expect(sut("abc")).toEqual(notMatched());
    });

    it("immediately propagates labelled failures", () => {
      const failingP: Parser<null> = () => notMatched("woops");
      const sut = many1(failingP);

      expect(sut("")).toEqual(notMatched("woops"));
    });
  });
});

describe("maybe", () => {
  describe("given a parser", () => {
    it("optionally matches", () => {
      const p: Parser<string> = input =>
        input.length === 1 ? matched("hello", input.slice(1)) : notMatched();
      const sut = maybe(p);

      expect(sut("a")).toEqual(matched("hello", ""));
      expect(sut("ab")).toEqual(matched(null, "ab"));
    });

    it("immediately propagates labelled failures", () => {
      const failingP: Parser<null> = () => notMatched("woops");
      const sut = maybe(failingP);

      expect(sut("")).toEqual(notMatched("woops"));
    });
  });
});

describe("not", () => {
  describe("given a parser", () => {
    it("matches if it fails, keeping the input intact", () => {
      const p: Parser<string> = () => notMatched();
      const sut = not(p);

      expect(sut("abc")).toEqual(matched(null, "abc"));
    });

    it("fails if it matches", () => {
      const p: Parser<string> = () => matched("abc", "def");
      const sut = not(p);

      expect(sut("abc")).toEqual(notMatched());
    });

    it("immediately propagates labelled failures", () => {
      const failingP: Parser<null> = () => notMatched("woops");
      const sut = not(failingP);

      expect(sut("")).toEqual(notMatched("woops"));
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
      const p: Parser<string> = () => notMatched();
      const sut = tag("hello", p);

      expect(sut("123")).toEqual(notMatched());
    });

    it("immediately propagates labelled failures", () => {
      const failingP: Parser<null> = () => notMatched("woops");
      const sut = tag("", failingP);

      expect(sut("")).toEqual(notMatched("woops"));
    });
  });
});

describe("fail", () => {
  describe("given a label", () => {
    it("fails using it", () => {
      const sut = fail("abc");

      expect(sut("def")).toEqual(notMatched("abc"));
    });
  });
});

describe("cstToAst", () => {
  type CSTBranch = CSTSeq | CSTMany;

  function cstBranch<Type extends "seq" | "many">(
    type: Type,
    children: Extract<CSTBranch, { type: Type }>["children"]
  ) {
    return { type, children } as Extract<CSTBranch, { type: Type }>;
  }

  function cstTagged(tag: string, child: CSTNode): CSTTagged {
    return { type: "tag", tag, child };
  }

  it("maintains leaves", () => {
    expect(cstToAst("a")).toEqual("a");
    expect(cstToAst(null)).toBeNull();
  });

  it("converts tagged leaves", () => {
    expect(cstToAst(cstTagged("abc", "a"))).toEqual({ abc: "a" });
    expect(cstToAst(cstTagged("foo", null))).toEqual({ foo: null });
  });

  it("joins sequences of leaves", () => {
    expect(cstToAst(cstBranch("seq", ["a", "b"]))).toEqual("ab");
    expect(cstToAst(cstBranch("seq", ["a", null, "c"]))).toEqual("ac");
  });

  it("merges sequences with tags", () => {
    expect(
      cstToAst(cstBranch("seq", [cstTagged("a", "b"), cstTagged("b", "c")]))
    ).toEqual({ a: "b", b: "c" });
    expect(
      cstToAst(cstBranch("seq", ["baz", cstTagged("one", "two"), null]))
    ).toEqual({ one: "two" });
  });

  it("merges nested sequences", () => {
    expect(
      cstToAst(
        cstBranch("seq", [
          cstBranch("seq", ["a", "b"]),
          cstBranch("seq", ["c", "d"])
        ])
      )
    ).toEqual("abcd");
  });

  it("merges nested tagged sequences", () => {
    expect(
      cstToAst(
        cstBranch("seq", [
          cstBranch("seq", [cstTagged("a", "1"), "b"]),
          cstBranch("seq", ["c", cstTagged("d", "2")])
        ])
      )
    ).toEqual({ a: "1", d: "2" });
  });

  it("converts tagged sequences", () => {
    expect(cstToAst(cstTagged("ab", cstBranch("seq", ["a", "b"])))).toEqual({
      ab: "ab"
    });
    expect(
      cstToAst(
        cstTagged(
          "hey",
          cstBranch("seq", [cstTagged("a", "b"), cstTagged("c", "d")])
        )
      )
    ).toEqual({ hey: { a: "b", c: "d" } });
  });

  it("joins many of leaves", () => {
    expect(cstToAst(cstBranch("many", []))).toEqual("");
    expect(cstToAst(cstBranch("many", ["a"]))).toEqual("a");
    expect(cstToAst(cstBranch("many", ["a", "b"]))).toEqual("ab");
    expect(cstToAst(cstBranch("many", ["a", null, "c"]))).toEqual("ac");
  });

  it("keeps tagged children", () => {
    expect(cstToAst(cstBranch("many", [cstTagged("a", "abc")]))).toEqual([
      { a: "abc" }
    ]);
    expect(
      cstToAst(
        cstBranch("many", [
          "a",
          cstTagged("b", "123"),
          null,
          cstTagged("b", "456")
        ])
      )
    ).toEqual([{ b: "123" }, { b: "456" }]);
  });

  it("joins nested many", () => {
    expect(
      cstToAst(
        cstBranch("many", [
          cstBranch("many", ["a"]),
          cstBranch("many", [null, "b", "c"])
        ])
      )
    ).toEqual("abc");
  });

  it("keeps nested tagged sequences", () => {
    expect(
      cstToAst(
        cstBranch("many", [
          cstBranch("many", [cstTagged("a", "1"), "b"]),
          cstBranch("many", [cstTagged("d", "1"), cstTagged("d", "2")])
        ])
      )
    ).toEqual([{ a: "1" }, { d: "1" }, { d: "2" }]);
  });

  it("converts tagged many", () => {
    expect(cstToAst(cstTagged("ab", cstBranch("many", ["a", "b"])))).toEqual({
      ab: "ab"
    });
    expect(
      cstToAst(
        cstTagged(
          "hey",
          cstBranch("many", [cstTagged("a", "b"), cstTagged("a", "c")])
        )
      )
    ).toEqual({ hey: [{ a: "b" }, { a: "c" }] });
  });

  it("joins up nested sequences and many", () => {
    expect(
      cstToAst(
        cstBranch("seq", [
          cstBranch("many", ["a", "a"]),
          cstBranch("many", ["b", "b"]),
          cstBranch("seq", [
            "c",
            null,
            "d",
            cstBranch("many", ["e", null, "f"])
          ])
        ])
      )
    ).toEqual("aabbcdef");
  });

  it("converts nested and tagged sequences and many", () => {
    expect(
      cstToAst(
        cstBranch("seq", [
          cstBranch("many", ["a", "a"]),
          cstBranch("many", [cstTagged("deep", "b")])
        ])
      )
    ).toEqual([{ deep: "b" }]);

    expect(
      cstToAst(
        cstBranch("seq", [
          cstBranch("many", ["a", "a"]),
          cstBranch("many", [cstTagged("deep", "b")]),
          cstTagged("foo", "123")
        ])
      )
    ).toEqual([{ deep: "b" }, { foo: "123" }]);

    expect(
      cstToAst(
        cstBranch("many", [
          cstBranch("seq", ["a", "b", cstTagged("last", "c")]),
          cstTagged("abc", cstBranch("many", [cstTagged("foo", "d")]))
        ])
      )
    ).toEqual([{ last: "c" }, { abc: [{ foo: "d" }] }]);
  });
});
