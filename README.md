# Sol syntax for TerminalCode

Syntax highlighting for the [Sol](https://github.com/Tim-kieboom/sol_frontend) programming language
(`.sol`, `.solc`) as a [TerminalCode](https://github.com/Tim-kieboom/TerminalCode) plugin: a port of
the Sol extension for Zed.

It is a language and nothing else: there is no code in it and no pane. The plugin is

- `sol.wasm`, the tree-sitter grammar built for WebAssembly (the same file the Zed extension has),
- `manifest.toml`, which says which files are Sol (`[language]`: `extensions`, `comment`) and has
  the highlight query as text.

TerminalCode loads the grammar in its sandbox (plugin API 1.12, so a TerminalCode newer than 0.10.2) and
colors the files with the query, using the colors of your theme: `@keyword`, `@string`, `@number`,
`@comment`, `@type`, `@function`, ... (`syntax.keyword` and so on in the theme file).

## Use

"Plugins: Manage", install **Sol**, and turn it on. `.sol` and `.solc` files are colored when they
are opened, and `ctrl+/` comments a line with `//`.

## The grammar

`grammar/` has the source of the grammar (`grammar.js`): it is shallow on purpose, a tokenizer with
a little structure (calls, format strings) that colors like the VS Code extension's regular
expressions, and not a parser for the whole language. To change it and build `sol.wasm` again:

```sh
cd grammar
npx tree-sitter-cli generate
npx tree-sitter-cli build --wasm -o ../sol.wasm
```

A new version needs a new `version` in `manifest.toml` and a release (the grammar is the file the
installer checks).

## The query

The query is the one of the Zed extension with the call patterns moved to the top: where two
patterns capture the same text TerminalCode takes the first, Zed the last.

## Licence

MIT or Apache-2.0, as the other plugins.
