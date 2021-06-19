import {
  bindAny,
  bindLeaf,
  bindSequence,
  CSTMany,
  CSTNode,
  CSTSeq,
  CSTTagged,
  cstToIst,
  istTransformer,
  rule
} from "../src";

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

describe("cstToIst", () => {
  it("maintains leaves", () => {
    expect(cstToIst("a")).toEqual("a");
    expect(cstToIst(null)).toBeNull();
  });

  it("converts tagged leaves", () => {
    expect(cstToIst(cstTagged("abc", "a"))).toEqual({ abc: "a" });
    expect(cstToIst(cstTagged("foo", null))).toEqual({ foo: null });
  });

  it("joins sequences of leaves", () => {
    expect(cstToIst(cstBranch("seq", ["a", "b"]))).toEqual("ab");
    expect(cstToIst(cstBranch("seq", ["a", null, "c"]))).toEqual("ac");
  });

  it("merges sequences with tags", () => {
    expect(
      cstToIst(cstBranch("seq", [cstTagged("a", "b"), cstTagged("b", "c")]))
    ).toEqual({ a: "b", b: "c" });
    expect(
      cstToIst(cstBranch("seq", ["baz", cstTagged("one", "two"), null]))
    ).toEqual({ one: "two" });
  });

  it("merges nested sequences", () => {
    expect(
      cstToIst(
        cstBranch("seq", [
          cstBranch("seq", ["a", "b"]),
          cstBranch("seq", ["c", "d"])
        ])
      )
    ).toEqual("abcd");
  });

  it("merges nested tagged sequences", () => {
    expect(
      cstToIst(
        cstBranch("seq", [
          cstBranch("seq", [cstTagged("a", "1"), "b"]),
          cstBranch("seq", ["c", cstTagged("d", "2")])
        ])
      )
    ).toEqual({ a: "1", d: "2" });
  });

  it("converts tagged sequences", () => {
    expect(cstToIst(cstTagged("ab", cstBranch("seq", ["a", "b"])))).toEqual({
      ab: "ab"
    });
    expect(
      cstToIst(
        cstTagged(
          "hey",
          cstBranch("seq", [cstTagged("a", "b"), cstTagged("c", "d")])
        )
      )
    ).toEqual({ hey: { a: "b", c: "d" } });
  });

  it("joins many of leaves", () => {
    expect(cstToIst(cstBranch("many", []))).toEqual([]);
    expect(cstToIst(cstBranch("many", ["a"]))).toEqual("a");
    expect(cstToIst(cstBranch("many", ["a", "b"]))).toEqual("ab");
    expect(cstToIst(cstBranch("many", ["a", null, "c"]))).toEqual("ac");
  });

  it("keeps tagged children", () => {
    expect(cstToIst(cstBranch("many", [cstTagged("a", "abc")]))).toEqual([
      { a: "abc" }
    ]);
    expect(
      cstToIst(
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
      cstToIst(
        cstBranch("many", [
          cstBranch("many", ["a"]),
          cstBranch("many", [null, "b", "c"])
        ])
      )
    ).toEqual("abc");
  });

  it("keeps nested tagged sequences", () => {
    expect(
      cstToIst(
        cstBranch("many", [
          cstBranch("many", [cstTagged("a", "1"), "b"]),
          cstBranch("many", [cstTagged("d", "1"), cstTagged("d", "2")])
        ])
      )
    ).toEqual([{ a: "1" }, { d: "1" }, { d: "2" }]);
  });

  it("converts tagged many", () => {
    expect(cstToIst(cstTagged("ab", cstBranch("many", ["a", "b"])))).toEqual({
      ab: "ab"
    });
    expect(
      cstToIst(
        cstTagged(
          "hey",
          cstBranch("many", [cstTagged("a", "b"), cstTagged("a", "c")])
        )
      )
    ).toEqual({ hey: [{ a: "b" }, { a: "c" }] });
  });

  it("joins up nested sequences and many", () => {
    expect(
      cstToIst(
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
      cstToIst(
        cstBranch("seq", [
          cstBranch("many", ["a", "a"]),
          cstBranch("many", [cstTagged("deep", "b")])
        ])
      )
    ).toEqual([{ deep: "b" }]);

    expect(
      cstToIst(
        cstBranch("seq", [
          cstBranch("many", ["a", "a"]),
          cstBranch("many", [cstTagged("deep", "b")]),
          cstTagged("foo", "123")
        ])
      )
    ).toEqual([{ deep: "b" }, { foo: "123" }]);

    expect(
      cstToIst(
        cstBranch("many", [
          cstBranch("seq", ["a", "b", cstTagged("last", "c")]),
          cstTagged("abc", cstBranch("many", [cstTagged("foo", "d")]))
        ])
      )
    ).toEqual([{ last: "c" }, { abc: [{ foo: "d" }] }]);

    expect(
      cstToIst(
        cstBranch("seq", [cstTagged("foo", "bar"), cstBranch("many", [])])
      )
    ).toEqual([{ foo: "bar" }]);
  });
});

describe("rule", () => {
  it("matches strings", () => {
    const sut = rule("a", () => "b");

    expect(sut("a")).toEqual("b");
    expect(sut("c")).toEqual("c");
  });

  it("matches an empty object", () => {
    const obj = {};
    const sut = rule(obj, () => 123);

    expect(sut(obj)).toEqual(123);
    expect(sut({})).toEqual(123);
    expect(sut({ a: "" })).toEqual({ a: "" });
    expect(sut("")).toEqual("");
    expect(sut([])).toEqual([]);
    expect(sut(null)).toBeNull();
  });

  it("matches each key and value of objects", () => {
    const sut = rule({ a: "a", b: { c: "" }, d: [] }, () => 456);

    expect(sut({ a: "a", b: { c: "" }, d: [] })).toEqual(456);
    expect(sut({ a: null, b: { c: "" }, d: [] })).toEqual({
      a: null,
      b: { c: "" },
      d: []
    });
    expect(sut({ a: "a", b: { c: ["b"] }, d: [] })).toEqual({
      a: "a",
      b: { c: ["b"] },
      d: []
    });
    expect(sut({ a: "a", b: { c: "" }, what: 1 })).toEqual({
      a: "a",
      b: { c: "" },
      what: 1
    });
  });

  it("matches empty arrays", () => {
    const ary: never[] = [];
    const sut = rule(ary, () => 789);

    expect(sut(ary)).toEqual(789);
    expect(sut([])).toEqual(789);
    expect(sut([""])).toEqual([""]);
    expect(sut("")).toEqual("");
    expect(sut({})).toEqual({});
    expect(sut(null)).toBeNull();
  });

  it("matches each element in arrays", () => {
    const sut = rule(["a", null, ["b"], { foo: "bar" }], () => 1001);

    expect(sut(["a", null, ["b"], { foo: "bar" }])).toEqual(1001);
    expect(sut(["a", "null", ["b"], { foo: "bar" }])).toEqual([
      "a",
      "null",
      ["b"],
      { foo: "bar" }
    ]);
    expect(sut(["a", ["b", "c"]])).toEqual(["a", ["b", "c"]]);
  });

  describe("when `bindLeaf` is used", () => {
    it("binds bindLeaf values", () => {
      const sut = rule(bindLeaf("x"), ({ x }) => ({ foo: "bar", x }));

      expect(sut(null)).toEqual({ foo: "bar", x: null });
      expect(sut("a")).toEqual({ foo: "bar", x: "a" });
      expect(sut({})).toEqual({ foo: "bar", x: {} });
      expect(sut([])).toEqual([]);
    });

    it("does not bind IST branches", () => {
      const sut = rule(bindLeaf("x"), ({ x }) => ({ foo: "bar", x }));
      const ist = cstToIst({ type: "tag", tag: "", child: "" });

      expect(sut(ist)).toBe(ist);
    });

    it("binds inside objects", () => {
      const sut = rule({ a: bindLeaf("a"), b: bindLeaf("b") }, ({ a, b }) => ({
        foo: "bar",
        a,
        b
      }));

      expect(sut({ a: "1", b: "2" })).toEqual({ foo: "bar", a: "1", b: "2" });
      expect(sut({ a: "1" })).toEqual({ a: "1" });
    });

    it("binds inside arrays", () => {
      const sut = rule([bindLeaf("a"), bindLeaf("b")], ({ a, b }) => ({
        foo: "bar",
        a,
        b
      }));

      expect(sut(["1", "2"])).toEqual({ foo: "bar", a: "1", b: "2" });
      expect(sut(["1"])).toEqual(["1"]);
    });
  });

  describe("when `bindSequence` is used", () => {
    it("binds sequences", () => {
      const sut = rule(bindSequence("s"), ({ s }) => ({ foo: "bar", s }));

      expect(sut([])).toEqual({ foo: "bar", s: [] });
      expect(sut([1, 2, 3])).toEqual({ foo: "bar", s: [1, 2, 3] });
      expect(sut(null)).toBeNull();
      expect(sut("a")).toEqual("a");
      expect(sut({})).toEqual({});
    });

    it("does not bind complex sequences", () => {
      const sut = rule(bindSequence("s"), ({ s }) => ({ foo: "bar", s }));

      expect(sut([[]])).toEqual([[]]);

      const ist = cstToIst({ type: "tag", tag: "", child: "" });
      expect(sut([ist])).toEqual([ist]);
    });
  });

  describe("when `bindAny` is used", () => {
    it("binds anything", () => {
      const sut = rule(bindAny("baz"), ({ baz }) => ({ foo: "bar", baz }));

      expect(sut(null)).toEqual({ foo: "bar", baz: null });
      expect(sut("a")).toEqual({ foo: "bar", baz: "a" });
      expect(sut({})).toEqual({ foo: "bar", baz: {} });
      expect(sut([])).toEqual({ foo: "bar", baz: [] });

      const ist = cstToIst({ type: "tag", tag: "", child: "" });
      expect(sut(ist)).toEqual({ foo: "bar", baz: ist });
    });
  });
});

describe("istTransformer", () => {
  describe("given one rule", () => {
    it("applies the rule on an IST recursively", () => {
      const sut = istTransformer(rule("a", () => "b"));

      expect(sut(cstToIst("a"))).toEqual("b");
      expect(sut(cstToIst(cstTagged("foo", "a")))).toEqual({ foo: "b" });
      expect(
        sut(
          cstToIst(
            cstBranch("many", [
              cstTagged("foo", "a"),
              cstTagged("foo", "c"),
              cstTagged("foo", null)
            ])
          )
        )
      ).toEqual([{ foo: "b" }, { foo: "c" }, { foo: null }]);
    });
  });

  describe("given multiple rules", () => {
    it("tries each rule in order", () => {
      const sut = istTransformer(
        rule("a", () => 1),
        rule({ foo: 1 }, () => 2)
      );

      expect(sut(cstToIst("a"))).toEqual(1);
      expect(sut(cstToIst(cstTagged("foo", "a")))).toEqual(2);
    });
  });
});
