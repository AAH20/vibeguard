export type Severity = 'high' | 'medium' | 'low';

export interface Finding {
  readonly rule: string;
  readonly severity: Severity;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  /** The exact source snippet the finding points at — lets a reader verify the finding without re-parsing. */
  readonly snippet: string;
}

export interface ParsedFile {
  readonly file: string;
  readonly source: string;
  readonly ast: import('@babel/types').File;
}

export interface Rule {
  readonly name: string;
  readonly severity: Severity;
  check(parsed: ParsedFile): Finding[];
}
