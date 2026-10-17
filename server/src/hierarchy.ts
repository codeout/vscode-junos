import type {
  CallHierarchyIncomingCall,
  CallHierarchyIncomingCallsParams,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyPrepareParams,
  Range,
} from "vscode-languageserver";
import { SymbolKind } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

import { pathWord, tokenizeLine } from "./config";
import type { Reference, Target } from "./references";
import { collectReferences, referencesOf, targetAt } from "./references";
import type { Session } from "./session";

/*
 * "Show Incoming Calls" (Shift+Alt+H) lists the uses of a name with the statements they are in, e.g. a
 * prefix-list used by "policy-statement PS1 › term rf" (from prefix-list). A use inside a definition can be
 * expanded to the uses of that definition: who imports PS1. "Show Outgoing Calls" lists the names a
 * definition uses.
 */

type Data = { uri: string; offset: number };

type Caller = {
  label: string; // "policy-statement PS1 › term rf"
  detail: string; // "from prefix-list"
  definition?: { start: number; end: number }; // the name of the definition the use is in (PS1)
};

const kindOf = (types: string[]) => (types.includes("interface") ? SymbolKind.Interface : SymbolKind.Variable);

function range(doc: TextDocument, r: { start: number; end: number }): Range {
  return { start: doc.positionAt(r.start), end: doc.positionAt(r.end) };
}

/**
 * The named entries (policy-statement PS1, term rf, group G, ...) of the statement a reference is in
 */
function callerOf(session: Session, doc: TextDocument, ref: Reference): Caller {
  const { view } = session.analyze(doc);
  const tokens = tokenizeLine(ref.statement.text, ref.statement.start);
  const path: string[] = [];
  const named: { keyword: string; name: string; start: number; end: number; index: number }[] = [];
  for (const [index, token] of tokens.entries()) {
    const word = pathWord(token);
    path.push(word);
    const node = session.parser.node(path.join(" "));
    if (index === 0 || node?.type !== "arg" || node.children.length === 0) {
      continue;
    }
    const start = view.toSourceOffset(token.start);
    named.push({ keyword: tokens[index - 1].text, name: token.text, start, end: start + token.text.length, index });
  }

  // the statement after the last entry, without an open bracket list ("import [ A")
  const last = named.at(-1);
  const detail = tokens
    .slice(last ? last.index + 1 : 0)
    .filter((t) => !t.unclosed)
    .map((t) => t.text)
    .join(" ");
  // the innermost entry that is a definition of its own
  const definition = named.findLast((n) => session.definitions.at(doc.uri, doc.positionAt(n.start)));
  return {
    label: named.length > 0 ? named.map((n) => `${n.keyword} ${n.name}`).join(" › ") : detail,
    detail: named.length > 0 ? detail : "",
    definition: definition && { start: definition.start, end: definition.end },
  };
}

function itemOf(doc: TextDocument, target: Target): CallHierarchyItem {
  return {
    name: target.name,
    kind: kindOf(target.types),
    detail: target.types[0]?.split(":", 1)[0],
    uri: doc.uri,
    range: range(doc, target.range),
    selectionRange: range(doc, target.range),
    data: { uri: doc.uri, offset: target.range.start } satisfies Data,
  };
}

function targetOf(session: Session, item: CallHierarchyItem) {
  const data = item.data as Data | undefined;
  const doc = data && session.documents.get(data.uri);
  const target = doc && targetAt(session, doc, data.offset);
  return doc && target ? { doc, target } : undefined;
}

export function prepareCallHierarchy(session: Session) {
  return (params: CallHierarchyPrepareParams): CallHierarchyItem[] | null => {
    const doc = session.documents.get(params.textDocument.uri);
    const target = doc && targetAt(session, doc, doc.offsetAt(params.position));
    return doc && target ? [itemOf(doc, target)] : null;
  };
}

export function incomingCalls(session: Session) {
  return (params: CallHierarchyIncomingCallsParams): CallHierarchyIncomingCall[] => {
    const found = targetOf(session, params.item);
    if (!found) {
      return [];
    }
    const { doc, target } = found;

    // uses in the same statement (term rf) are one caller
    const calls = new Map<string, CallHierarchyIncomingCall>();
    const list: CallHierarchyIncomingCall[] = [];
    for (const ref of referencesOf(session, doc, target)) {
      const caller = callerOf(session, doc, ref);
      const key = `${caller.label}\u{0}${caller.detail}`;
      const call = calls.get(key);
      if (call) {
        call.fromRanges.push(range(doc, ref));
        continue;
      }

      const at = caller.definition ?? ref;
      const created: CallHierarchyIncomingCall = {
        from: {
          name: caller.label,
          detail: caller.detail,
          kind: SymbolKind.Object,
          uri: doc.uri,
          range: range(doc, ref),
          selectionRange: range(doc, ref),
          data: { uri: doc.uri, offset: at.start } satisfies Data,
        },
        fromRanges: [range(doc, ref)],
      };
      calls.set(key, created);
      list.push(created);
    }
    return list;
  };
}

export function outgoingCalls(session: Session) {
  return (params: CallHierarchyOutgoingCallsParams): CallHierarchyOutgoingCall[] => {
    const found = targetOf(session, params.item);
    if (!found) {
      return [];
    }
    const { doc, target } = found;

    // names used inside the definition's statements
    const calls = new Map<string, CallHierarchyOutgoingCall>();
    const list: CallHierarchyOutgoingCall[] = [];
    for (const ref of collectReferences(session, doc)) {
      const { definition } = callerOf(session, doc, ref);
      const owner = definition && targetAt(session, doc, definition.start);
      const same =
        owner?.name === target.name &&
        owner.logicalSystem === target.logicalSystem &&
        owner.types.some((t) => target.types.includes(t));
      if (!same) {
        continue;
      }

      // the end of the name: the unit of "irb.102", not its interface
      const used = targetAt(session, doc, ref.end);
      if (!used) {
        continue;
      }
      const key = `${used.name}\u{0}${used.types.join(",")}`;
      const call = calls.get(key);
      if (call) {
        call.fromRanges.push(range(doc, ref));
      } else {
        const created = { to: itemOf(doc, used), fromRanges: [range(doc, ref)] };
        calls.set(key, created);
        list.push(created);
      }
    }
    return list;
  };
}
