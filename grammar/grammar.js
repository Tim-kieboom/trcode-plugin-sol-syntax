/**
 * @file Grammar for the Sol programming language (highlighting-focused)
 * @license MIT
 *
 * This grammar is deliberately shallow: it tokenizes Sol source the same way the
 * hand-written TextMate grammar (editors/vscode-sol) does, plus a small amount of real
 * structure (call expressions, format-string interpolation) so highlighting for function
 * names and interpolated code stays correct. It is not a full parser for the language
 * described in sol-lang.md.
 */

const PRIMITIVE_TYPES = [
  "varargs", "any", "This", "str", "fstr", "this", "cint", "cstr",
  "int", "i8", "i16", "i32", "i64", "i128",
  "cuint", "uint", "u8", "u16", "u32", "u64", "u128",
  "char", "char8", "char16", "char32", "char64",
  "bool", "f16", "f32", "f64",
];

const CONSTANTS = ["true", "false", "none", "null", "undefined"];

const KEYWORDS = [
  "task", "spawn", "unsafe", "intrinsic", "pub", "mod", "crate", "panic",
  "print", "println", "new", "impl", "union", "catch", "where", "match",
  "await", "sizeof", "typeof", "type", "distinct", "extern", "import",
  "in", "limit", "pass", "if", "else", "for", "while", "as", "return",
  "continue", "break", "copy", "struct", "trait", "enum", "use", "move",
  "dyn",
];

const STORAGE_MODIFIERS = ["mut", "const", "async"];

module.exports = grammar({
  name: "sol",

  extras: ($) => [/\s/, $.line_comment, $.block_comment],

  word: ($) => $.identifier,

  conflicts: ($) => [[$._item, $.call_expression]],

  rules: {
    source_file: ($) => repeat($._item),

    // Every bracket, brace and paren always opens a recursively-nested
    // group rather than appearing as a free token. This is what lets
    // tree-sitter resolve where each one closes without ambiguity: there
    // is exactly one grammar rule that can consume a given '(', so the
    // parser never has to choose between "this closes the enclosing group"
    // and "this is a standalone item".
    _item: ($) =>
      choice(
        $.attribute,
        $.keyword,
        $.storage_modifier,
        $.constant,
        $.primitive_type,
        $.lifetime,
        $.format_string,
        $.string,
        $.char_literal,
        $.number,
        $.call_expression,
        $.type_identifier,
        $.identifier,
        $.operator,
        $.group_paren,
        $.group_bracket,
        $.group_brace,
        ",", ".", ":", ";", "<", ">",
      ),

    group_paren: ($) => seq("(", repeat($._item), ")"),
    group_bracket: ($) => seq("[", repeat($._item), "]"),
    group_brace: ($) => seq("{", repeat($._item), "}"),

    // --- comments -----------------------------------------------------

    line_comment: (_$) => token(seq("//", /.*/)),
    block_comment: (_$) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),

    // --- attributes: #[test] etc. --------------------------------------

    attribute: ($) => seq("#", $.group_bracket),

    // --- keywords / modifiers / constants ------------------------------

    keyword: (_$) => token(choice(...KEYWORDS)),
    storage_modifier: (_$) => token(choice(...STORAGE_MODIFIERS)),
    constant: (_$) => token(choice(...CONSTANTS)),
    primitive_type: (_$) => token(choice(...PRIMITIVE_TYPES)),

    // --- identifiers ----------------------------------------------------

    identifier: (_$) => /[a-z_][a-zA-Z0-9_]*/,
    type_identifier: (_$) => /[A-Z][a-zA-Z0-9_]*/,

    lifetime: (_$) => token(seq("'", /[a-zA-Z_][a-zA-Z0-9_]*/)),

    call_expression: ($) =>
      prec.dynamic(
        1,
        seq(
          field(
            "function",
            choice($.identifier, $.type_identifier, $.primitive_type),
          ),
          optional(field("type_arguments", $.generic_arguments)),
          field("arguments", alias($.group_paren, $.arguments)),
        ),
      ),

    // `<...>` before a call's argument list, e.g. `func<T>()`. Declared
    // with dynamic precedence (see `conflicts` below) since a bare `<` is
    // also the less-than operator — tree-sitter tries both parses and
    // keeps this one only when it actually closes with `>` and is
    // followed by `(`.
    generic_arguments: ($) =>
      prec.dynamic(
        1,
        seq("<", $._generic_arg, repeat(seq(",", $._generic_arg)), ">"),
      ),

    _generic_arg: ($) =>
      seq(
        repeat(choice("&", $.storage_modifier, $.lifetime)),
        choice(
          $.generic_arguments,
          $.type_identifier,
          $.primitive_type,
          $.identifier,
        ),
        // `T: Display` — an inline trait bound on a generic parameter.
        optional(seq(":", $._generic_arg_value)),
        // `O = none` — a default type parameter.
        optional(seq("=", $._generic_arg_value)),
      ),

    _generic_arg_value: ($) =>
      choice(
        $.generic_arguments,
        $.type_identifier,
        $.primitive_type,
        $.identifier,
        $.constant,
        $.number,
        $.string,
      ),

    // --- literals ---------------------------------------------------------

    number: (_$) =>
      token(
        seq(
          /[0-9][0-9_]*/,
          optional(seq(".", /[0-9][0-9_]*/)),
          optional(seq(/[eE][+-]?/, /[0-9]+/)),
          optional(seq("_", /[a-zA-Z][a-zA-Z0-9]*/)),
        ),
      ),

    string: ($) =>
      seq('"', repeat(choice($.escape_sequence, /[^"\\]+/)), '"'),

    // Kept atomic (single token) so the lexer's longest-match rule always
    // prefers a closed char literal ('a') over a lifetime ('a) when both
    // could start at the same quote.
    char_literal: (_$) =>
      token(seq("'", choice(seq("\\", /./), /[^'\\]/), "'")),

    escape_sequence: (_$) => token(seq("\\", /./)),

    // The tag and opening quote are lexed as one atomic token (e.g. `f"`,
    // `fstr"`, `c"`) so a bare identifier named `f` or `c` never conflicts
    // with the start of a format string.
    format_string: ($) =>
      seq(
        alias(token(seq(choice("fstr", "f", "c"), '"')), $.string_start),
        repeat(
          choice(
            $.escape_sequence,
            $.interpolation,
            token(prec(-1, /[^"\\{]+/)),
          ),
        ),
        '"',
      ),

    interpolation: ($) => seq("{", repeat($._item), "}"),

    // --- operators / punctuation -------------------------------------------

    operator: (_$) =>
      token(
        choice(
          "::", ":=", "=>", "==", "!=", "<=", ">=", "+=", "-=", "*=", "/=",
          "..", "&&", "||", "+", "-", "*", "/", "%", "=", "&",
          "!", "?", "|", "^", "~",
        ),
      ),

  },
});
