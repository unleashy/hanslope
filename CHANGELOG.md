# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## Added

- Basic parsers: `any`, `str`, `re`, `or`, `seq`, `many`, `many1`, `maybe`,
  `not`, `tag`
- `fail` creates a labelled failure, which is like a throw for parsers
- `failLabel(parser, label)` is a shortcut for `or(parser, fail(label))`
- `cstToIst` transforms a CST to an IST
- `istTransformer` uses `rule`s to transform your IST into a real AST
- `parseGrammar` parses a textual grammar into an AST

[unreleased]: https://github.com/unleashy/vahv/compare/v0.1.0...HEAD
