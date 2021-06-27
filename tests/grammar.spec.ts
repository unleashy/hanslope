import {
  AST,
  ASTAny,
  ASTChoice,
  ASTFail,
  ASTFailAttached,
  ASTGrammar,
  ASTMaybe,
  ASTName,
  ASTNegation,
  ASTOneOrMore,
  ASTRegex,
  ASTRule,
  ASTSequence,
  ASTString,
  ASTTagged,
  ASTZeroOrMore,
  ParseError,
  parseGrammar
} from "../src/grammar";

describe("parseGrammar", () => {
  it("throws on empty grammars", () => {
    expect(() => parseGrammar("")).toThrow(
      new ParseError("grammar is empty at line 1, column 1")
    );
    expect(() => parseGrammar("  ")).toThrow(
      new ParseError("grammar is empty at line 1, column 1")
    );
  });

  it("throws on missing rule arrow", () => {
    expect(() => parseGrammar("ABC")).toThrow(
      new ParseError("expected '<-' after rule name at line 1, column 4")
    );
  });

  it("throws on missing rule expression", () => {
    expect(() => parseGrammar("foo <-")).toThrow(
      new ParseError("expected an expression for rule at line 1, column 7")
    );
  });

  it("throws on missing rule semicolon", () => {
    expect(() => parseGrammar("foo <- any")).toThrow(
      new ParseError("expected a semicolon after rule at line 1, column 11")
    );
  });

  it("parses a rule with 'any'", () => {
    expect(parseGrammar(" Simple_123 <- any ; ")).toEqual(
      new ASTGrammar([new ASTRule("Simple_123", new ASTAny())])
    );
  });

  it("parses multiple rules", () => {
    expect(
      parseGrammar(
        `
        a <- any ;
        b <- any ;
        c <- any ;
        `
      )
    ).toEqual(
      new ASTGrammar([
        new ASTRule("a", new ASTAny()),
        new ASTRule("b", new ASTAny()),
        new ASTRule("c", new ASTAny())
      ])
    );
  });

  it("parses a rule with a sequence", () => {
    expect(parseGrammar("seq <- any any any;")).toEqual(
      new ASTGrammar([
        new ASTRule(
          "seq",
          new ASTSequence([new ASTAny(), new ASTAny(), new ASTAny()])
        )
      ])
    );
  });

  it("parses a rule with choice", () => {
    expect(parseGrammar("choice <- any | any | any ;")).toEqual(
      new ASTGrammar([
        new ASTRule(
          "choice",
          new ASTChoice([new ASTAny(), new ASTAny(), new ASTAny()])
        )
      ])
    );
  });

  it("throws on a missing choice", () => {
    expect(() => parseGrammar("a <- any | any | ")).toThrow(
      new ParseError("expected expression after '|' at line 1, column 17")
    );
  });

  it("parses postfix modifiers", () => {
    expect(parseGrammar("rep <- any* any+ any? ;")).toEqual(
      new ASTGrammar([
        new ASTRule(
          "rep",
          new ASTSequence([
            new ASTZeroOrMore(new ASTAny()),
            new ASTOneOrMore(new ASTAny()),
            new ASTMaybe(new ASTAny())
          ])
        )
      ])
    );
  });

  it("parses negation", () => {
    expect(parseGrammar("neg <- !any ;")).toEqual(
      new ASTGrammar([new ASTRule("neg", new ASTNegation(new ASTAny()))])
    );
  });

  it("parses tags", () => {
    expect(parseGrammar("tag <- any:foo_Bar123 ;")).toEqual(
      new ASTGrammar([
        new ASTRule("tag", new ASTTagged(new ASTAny(), "foo_Bar123"))
      ])
    );
  });

  it("throws on missing tag name", () => {
    expect(() => parseGrammar("tag <- any: ;")).toThrow(
      new ParseError("expected a tag after ':' at line 1, column 12")
    );
  });

  it("parses names", () => {
    expect(parseGrammar(`names <- A bc _d0123_456789e_fgh_ ;`)).toEqual(
      new ASTGrammar([
        new ASTRule(
          "names",
          new ASTSequence([
            new ASTName("A"),
            new ASTName("bc"),
            new ASTName("_d0123_456789e_fgh_")
          ])
        )
      ])
    );
  });

  it("parses strings", () => {
    expect(
      parseGrammar(
        String.raw`
        strings <- ""
                   "  "
                   "foobar 123"
                   "\0\'\"\\\n\r\v\t\b\f\h"
                   lit"áêìöų" ;
        `
      )
    ).toEqual(
      new ASTGrammar([
        new ASTRule(
          "strings",
          new ASTSequence([
            new ASTString(""),
            new ASTString("  "),
            new ASTString("foobar 123"),
            new ASTString("\0'\"\\\n\r\v\t\b\fh"),
            new ASTString("áêìöų", false)
          ])
        )
      ])
    );
  });

  it("throws on unclosed strings", () => {
    expect(() => parseGrammar(`A <- "abcd\n`)).toThrow(
      new ParseError(`expected '"' to close string at line 2, column 1`)
    );
  });

  it("parses regexes", () => {
    expect(
      parseGrammar(
        String.raw`
        regexes <- / abc [123] /
                   /\/\n/
                   /something/i
                   /\(/misu
                   lit/bread/s ;
        `
      )
    ).toEqual(
      new ASTGrammar([
        new ASTRule(
          "regexes",
          new ASTSequence([
            new ASTRegex(/ abc [123] /),
            new ASTRegex(/\/\n/),
            new ASTRegex(/something/i),
            new ASTRegex(/\(/imsu),
            new ASTRegex(/bread/s, false)
          ])
        )
      ])
    );
  });

  it("throws on unclosed regexes", () => {
    expect(() => parseGrammar(`A <-\n/abcd`)).toThrow(
      new ParseError(`expected '/' to close string at line 2, column 6`)
    );
  });

  it("parses fail instructions", () => {
    expect(parseGrammar(`failure <- ~label ;`)).toEqual(
      new ASTGrammar([new ASTRule("failure", new ASTFail("label"))])
    );
  });

  it("throws on missing fail label", () => {
    expect(() => parseGrammar(`a <- ~ ;`)).toThrow(
      new ParseError("expected a label after '~' at line 1, column 7")
    );
  });

  it("parses attached fail instructions", () => {
    expect(parseGrammar(`failure <- any~label ;`)).toEqual(
      new ASTGrammar([
        new ASTRule("failure", new ASTFailAttached("label", new ASTAny()))
      ])
    );
  });

  it("throws on missing attached fail label", () => {
    expect(() => parseGrammar(`a <- any~ ;`)).toThrow(
      new ParseError("expected a label after '~' at line 1, column 10")
    );
  });

  it("parses multiple complex rules", () => {
    expect(
      parseGrammar(
        `
        Foo <- Bar ;
        Bar <- "a"+ Baz ;
        Baz <- "b"~missingB ;
        `
      )
    ).toEqual(
      new ASTGrammar([
        new ASTRule("Foo", new ASTName("Bar")),
        new ASTRule(
          "Bar",
          new ASTSequence([
            new ASTOneOrMore(new ASTString("a")),
            new ASTName("Baz")
          ])
        ),
        new ASTRule("Baz", new ASTFailAttached("missingB", new ASTString("b")))
      ])
    );
  });

  it("can parse parenthesised expressions", () => {
    expect(parseGrammar(`parens <- any (any | any)* "foo" ;`)).toEqual(
      new ASTGrammar([
        new ASTRule(
          "parens",
          new ASTSequence([
            new ASTAny(),
            new ASTZeroOrMore(new ASTChoice([new ASTAny(), new ASTAny()])),
            new ASTString("foo")
          ])
        )
      ])
    );
  });

  it("throws on unclosed parenthesis", () => {
    expect(() => parseGrammar(`parens <- (any ;`)).toThrow(
      new ParseError("expected ')' to close matching '(' at line 1, column 15")
    );
  });
});

function testVisitor<T extends AST>(node: T) {
  const name = node.constructor.name.slice(3);
  const visitorName = `visit${name}`;

  // eslint-disable-next-line jest/valid-title
  describe(name, () => {
    describe(".accept", () => {
      it(`calls \`${visitorName}\` on the visitor`, () => {
        const visitor = { [visitorName]: jest.fn().mockReturnValue(123) };
        const sut = node;

        expect(sut.accept(visitor as never)).toEqual(123);
        expect(visitor[visitorName]).toHaveBeenCalledWith(sut);
      });
    });
  });
}

testVisitor(new ASTGrammar([new ASTRule("", new ASTAny())]));
testVisitor(new ASTRule("", new ASTAny()));
testVisitor(new ASTChoice([new ASTAny(), new ASTAny()]));
testVisitor(new ASTSequence([new ASTAny(), new ASTAny()]));
testVisitor(new ASTZeroOrMore(new ASTAny()));
testVisitor(new ASTOneOrMore(new ASTAny()));
testVisitor(new ASTMaybe(new ASTAny()));
testVisitor(new ASTNegation(new ASTAny()));
testVisitor(new ASTTagged(new ASTAny(), ""));
testVisitor(new ASTAny());
testVisitor(new ASTName(""));
testVisitor(new ASTString(""));
testVisitor(new ASTRegex(/ /));
testVisitor(new ASTFail(""));
testVisitor(new ASTFailAttached("", new ASTAny()));
