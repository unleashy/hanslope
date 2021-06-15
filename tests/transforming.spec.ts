import { CSTMany, CSTNode, CSTSeq, CSTTagged, cstToIst } from "../src";

describe("cstToIst", () => {
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
    expect(cstToIst(cstBranch("many", []))).toEqual("");
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
  });
});
