import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as ts from "typescript";

// The draft board's render cost rests on a contract no type or lint rule checks: BoardTable,
// BoardRow and BoardToolbar are memoized, and every prop the room hands them keeps its
// identity from one render to the next. An inline arrow or a fresh object at the call site
// type-checks, lints and works, and quietly puts every one of ~600 rows back into each
// highlight, j/k press and sync frame (15 ms on an M3 and 62 ms at 4x CPU throttle against
// about 1 ms, measured on a 608-row categories board). The repo has no DOM test setup to
// render the room, so these read the source and pin the shape the memo depends on.

function source(file: string): ts.SourceFile {
  const path = join(import.meta.dir, "../../components/draft", file);
  return ts.createSourceFile(file, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function descendants(node: ts.Node): ts.Node[] {
  const out: ts.Node[] = [];
  const walk = (n: ts.Node) => {
    out.push(n);
    n.forEachChild(walk);
  };
  node.forEachChild(walk);
  return out;
}

function declaration(sf: ts.SourceFile, name: string): ts.VariableDeclaration | undefined {
  return descendants(sf).find(
    (n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name
  );
}

function calleeOf(expr: ts.Expression | undefined): string | null {
  return expr && ts.isCallExpression(expr) ? expr.expression.getText() : null;
}

/** Every `<Tag ...>` in the file, as its attribute list. */
function usages(sf: ts.SourceFile, tag: string): ts.JsxAttributes[] {
  return descendants(sf)
    .filter((n): n is ts.JsxSelfClosingElement | ts.JsxOpeningElement => ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n))
    .filter((n) => n.tagName.getText() === tag)
    .map((n) => n.attributes);
}

/** Anything in a prop's value that is built anew on every render. */
function freshParts(value: ts.Node): string[] {
  return [value, ...descendants(value)]
    .filter(
      (n) =>
        ts.isArrowFunction(n) ||
        ts.isFunctionExpression(n) ||
        ts.isObjectLiteralExpression(n) ||
        ts.isArrayLiteralExpression(n) ||
        ts.isJsxElement(n) ||
        ts.isJsxSelfClosingElement(n) ||
        ts.isJsxFragment(n) ||
        ts.isNewExpression(n) ||
        (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "bind")
    )
    .map((n) => n.getText());
}

function attrName(a: ts.JsxAttributeLike): string {
  return ts.isJsxAttribute(a) ? a.name.getText() : `{...${a.expression.getText()}}`;
}

function attrValue(a: ts.JsxAttributeLike): ts.Expression | undefined {
  if (ts.isJsxSpreadAttribute(a)) return a.expression;
  const init = a.initializer;
  return init && ts.isJsxExpression(init) ? init.expression : undefined;
}

/** The props of `<tag>` whose value is built at the call site, as "prop: text". */
function freshProps(sf: ts.SourceFile, tag: string): string[] {
  return usages(sf, tag).flatMap((attrs) =>
    attrs.properties.flatMap((a) => {
      const v = attrValue(a);
      return v ? freshParts(v).map((t) => `${attrName(a)}: ${t}`) : [];
    })
  );
}

/**
 * A callback prop is stable when it is `undefined` or names a function that keeps one
 * identity: a useLatestCallback, a draft room store action (zustand's actions never change),
 * or a useCallback whose dependencies are all stable themselves. A useCallback over the model
 * or the sync object is not: both are rebuilt on every render. Through a ternary, both
 * branches must be stable.
 */
function stableCallback(sf: ts.SourceFile, value: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(value)) return stableCallback(sf, value.expression);
  if (ts.isConditionalExpression(value)) return stableCallback(sf, value.whenTrue) && stableCallback(sf, value.whenFalse);
  if (!ts.isIdentifier(value)) return false;
  if (value.text === "undefined") return true;
  const decl = declaration(sf, value.text);
  if (decl) {
    const init = decl.initializer;
    if (!init || !ts.isCallExpression(init)) return false;
    const hook = init.expression.getText();
    if (hook === "useLatestCallback") return true;
    const deps = init.arguments[1];
    return hook === "useCallback" && deps != null && ts.isArrayLiteralExpression(deps) && deps.elements.every((d) => stableCallback(sf, d));
  }
  const binding = descendants(sf).find(
    (n): n is ts.BindingElement => ts.isBindingElement(n) && ts.isIdentifier(n.name) && n.name.text === value.text
  );
  const holder = binding?.parent.parent;
  return holder != null && ts.isVariableDeclaration(holder) && calleeOf(holder.initializer) === "useDraftRoomStore";
}

describe("draft board memo contract", () => {
  const board = source("Board.tsx");
  const room = source("RoomView.tsx");

  test("the table, its rows and the toolbar are memoized", () => {
    for (const name of ["BoardTable", "BoardRow", "BoardToolbar"]) {
      expect({ name, wrappedIn: calleeOf(declaration(board, name)?.initializer) }).toEqual({ name, wrappedIn: "memo" });
    }
  });

  test("the room builds nothing inline for the board or the toolbar", () => {
    expect(usages(room, "BoardTable")).toHaveLength(1);
    expect(usages(room, "BoardToolbar")).toHaveLength(1);
    expect(freshProps(room, "BoardTable")).toEqual([]);
    expect(freshProps(room, "BoardToolbar")).toEqual([]);
  });

  test("the table builds nothing inline for a row", () => {
    expect(usages(board, "BoardRow")).toHaveLength(1);
    expect(freshProps(board, "BoardRow")).toEqual([]);
  });

  // The room's own handlers close over the model and the sync object, which are rebuilt on
  // every render; handed over directly they would re-render every row each time. Passed
  // through useLatestCallback they keep one identity and still reach the newest model, so a
  // memoized row that did not re-render never picks through an old one.
  test("every callback the room hands the board or the toolbar keeps its identity", () => {
    const unstable = ["BoardTable", "BoardToolbar"].flatMap((tag) =>
      usages(room, tag).flatMap((attrs) =>
        attrs.properties
          .filter((a) => /^on[A-Z]/.test(attrName(a)))
          .filter((a) => {
            const v = attrValue(a);
            return v == null || !stableCallback(room, v);
          })
          .map((a) => `${tag} ${attrName(a)}={${attrValue(a)?.getText()}}`)
      )
    );
    expect(unstable).toEqual([]);
  });
});
