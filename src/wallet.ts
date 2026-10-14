/** Display only an amount explicitly called a balance in Wren's reply. Never infer it from withdrawals. */
// shortcut: prose can omit or paraphrase amounts; use a structured disclosed balance if the API adds one.
export function disclosedBalance(reply: string): string | null {
  const match = /\b(?:available |current |account )?balance\s*(?:is|of|stands at|comes to|:)\s*(\$\s*\d[\d,]*(?:\.\d{1,2})?)/i.exec(reply);
  return match?.[1] ?? null;
}
